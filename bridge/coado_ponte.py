#!/usr/bin/env python3
"""Ponte vault <-> Coado: o estudo acadêmico com dois painéis de controle e um estado só.

Cada rodada lê os dois lados, compara com a última base comum (sincronização em três vias) e
aplica em cada lado só o que mudou no outro. Sem processo residente: roda, sincroniza, sai.

Lados e donos
  catálogo (plano, disciplinas, tópicos, categorias): a vault, só vault -> Coado
  estudos: os dois. Na vault, cada estudo é uma entrada de `timeEntries` (formato do TaskNotes)
           na nota-razão da disciplina ou numa tarefa acadêmica com `class:`
  revisões, planejamento (ciclo), tópicos concluídos, metas e intervalos: os dois, pela nota de
           estado do semestre (`System/Academico/Semestres/<semestre> Estudo.md`)
  conflito (os dois lados mudaram o mesmo item desde a base): vence a vault, e fica no log

Uso
  coado_ponte.py --config ~/.config/mecha-tutor/coado-teste.env [--init] [--seco] [-v]
"""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import math
import os
import re
import secrets
import shutil
import sqlite3
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

import yaml

TZ = ZoneInfo("America/Sao_Paulo")
STATE_DIR = os.path.expanduser("~/.hermes/mecha-tutor/state")
LOG_DIR = os.path.expanduser("~/.hermes/mecha-tutor/logs")
MIN_SEGUNDOS = 60                 # entradas menores são liga-e-desliga e não sincronizam
ANKI_PADRAO = os.path.expanduser("~/.local/share/Anki2/Usuário 1/collection.anki2")
ANKI_PAUSA_MS = 10 * 60 * 1000    # intervalo sem revisar que fecha uma sessão do Anki
ID_OK = re.compile(r"^[A-Za-z0-9_-]{1,64}$")   # o que o Coado aceita como id
PALETA = ["#e7b7a3", "#d9c3a5", "#c9d3b3", "#b8cfc6", "#e8c6c0", "#dfd0b8", "#c6b9d3", "#a9c5c9",
          "#f0cfa8", "#c8b7a6", "#b7c9b1", "#e3b9b1", "#d6c4de", "#a8bfd4", "#e9d5a1", "#bcd2bd"]
CATEGORIAS = [("teoria", "Teoria", True), ("revisao", "Revisão", True), ("questoes", "Questões", True),
              ("execucao", "Execução", False)]
STATUS_V2C = {"pendente": "pending", "feita": "done", "ignorada": "ignored"}
STATUS_C2V = {v: k for k, v in STATUS_V2C.items()}


# ───────────────────────────── YAML do frontmatter ─────────────────────────────

class _Loader(getattr(yaml, "CSafeLoader", yaml.SafeLoader)):
    """SafeLoader que mantém datas e horas como texto (o TaskNotes grava ISO e lê ISO)."""


_Loader.yaml_implicit_resolvers = {k: [r for r in v if r[0] != "tag:yaml.org,2002:timestamp"]
                                   for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}


class _Dumper(yaml.SafeDumper):
    def increase_indent(self, flow=False, indentless=False):   # listas indentadas sob a chave
        return super().increase_indent(flow, False)


def _str_rep(d, s):
    return d.represent_scalar("tag:yaml.org,2002:str", s, style='"' if (":" in s or s.startswith(("[", "#", "{"))) else None)


_Dumper.add_representer(str, _str_rep)


def ler_nota(path):
    with open(path, encoding="utf-8") as f:
        texto = f.read()
    m = re.match(r"^---\n(.*?)\n---\n?", texto, re.S)
    if not m:
        return {}, texto, os.stat(path).st_mtime_ns
    return (yaml.load(m.group(1), Loader=_Loader) or {}), texto[m.end():], os.stat(path).st_mtime_ns


def gravar_nota(path, fm, corpo, mtime_lido=None):
    """Grava de forma atômica. Se o arquivo mudou desde a leitura, desiste (a próxima rodada refaz)."""
    if mtime_lido is not None and os.path.exists(path) and os.stat(path).st_mtime_ns != mtime_lido:
        raise RuntimeError(f"mudou durante a rodada: {path}")
    y = yaml.dump(fm, Dumper=_Dumper, allow_unicode=True, sort_keys=False, default_flow_style=False, width=1000)
    texto = f"---\n{y}---\n{corpo}"
    d = os.path.dirname(path)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".coado-", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(texto)
    os.replace(tmp, path)


def _eh_da_ponte(item):
    return any(re.match(r"^\s*-?\s*fonte:\s*['\"]?coado['\"]?\s*$", l) for l in item)


def gravar_tarefa(path, fm, mtime_lido=None):
    """Grava numa tarefa do Davi só os itens de tempo que a ponte mantém (`fonte: coado`): tira os antigos e põe os
    atuais no fim de `timeEntries`. O resto do frontmatter, que é dele, não é regravado nem reformatado."""
    if mtime_lido is not None and os.path.exists(path) and os.stat(path).st_mtime_ns != mtime_lido:
        raise RuntimeError(f"mudou durante a rodada: {path}")
    with open(path, encoding="utf-8") as f:
        texto = f.read()
    m = re.match(r"^---\n(.*?)\n---\n?", texto, re.S)
    if not m:
        raise RuntimeError(f"sem frontmatter: {path}")
    linhas = m.group(1).split("\n")
    k = next((i for i, l in enumerate(linhas) if re.match(r"^timeEntries:\s*(\[\s*\])?\s*$", l)), None)
    if k is None:
        linhas.append("timeEntries:")
        k = len(linhas) - 1
    linhas[k] = "timeEntries:"
    fim = k + 1
    while fim < len(linhas) and (linhas[fim].startswith(" ") or linhas[fim].startswith("-") or not linhas[fim].strip()):
        fim += 1
    itens, atual = [], None
    for l in linhas[k + 1:fim]:
        if re.match(r"^\s*- ", l):
            atual = [l]
            itens.append(atual)
        elif atual is not None:
            atual.append(l)
    recuo = re.match(r"^(\s*)- ", itens[0][0]).group(1) if itens else "  "
    mantidos = [l for item in itens if not _eh_da_ponte(item) for l in item]
    novos = []
    for e in fm.get("timeEntries") or []:
        if isinstance(e, dict) and e.get("fonte") == "coado":
            y = yaml.safe_dump(e, allow_unicode=True, sort_keys=False, default_flow_style=False, width=1000).rstrip("\n").split("\n")
            novos += [f"{recuo}- {y[0]}"] + [f"{recuo}  {l}" for l in y[1:]]
    linhas = linhas[:k + 1] + mantidos + novos + linhas[fim:]
    if not mantidos and not novos:
        linhas[k] = "timeEntries: []"
    novo = "---\n" + "\n".join(linhas) + "\n---\n" + texto[m.end():]
    if novo == texto:
        return
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".coado-", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(novo)
    os.replace(tmp, path)


# ───────────────────────────── algoritmo do ciclo (porte do Coado) ─────────────────────────────

def js_round(x):
    """Math.round do JavaScript: empate sobe (o round do Python arredonda para o par)."""
    return math.floor(x + 0.5)


def gerar_ciclo(cfg):
    """Porte de `generateCycle` (apps/web/src/lib/utils.ts do Coado, commit 4625e58)."""
    subs = [s for s in cfg["subjects"] if s["importance"] > 0]
    if not subs:
        return []
    pesos = [s["importance"] * (6 - s["knowledge"]) for s in subs]
    soma = sum(pesos)
    total = max(cfg["weeklyMinutes"], cfg["minSession"] * len(subs))
    para = lambda v, passo: max(passo, js_round(v / passo) * passo)
    filas = []
    for s, w in zip(subs, pesos):
        minutos = max(cfg["minSession"], para(w / soma * total, 15))
        n = max(1, math.ceil(minutos / cfg["maxSession"]))
        sessao = min(cfg["maxSession"], max(cfg["minSession"], para(minutos / n, 15)))
        filas.append({"s": s["subjectId"], "w": w, "sessoes": [sessao] * n})
    out, ultimo = [], None
    while any(f["sessoes"] for f in filas):
        cand = sorted([f for f in filas if f["sessoes"]], key=lambda f: (-len(f["sessoes"]), -f["w"]))  # estável, como o sort do JS
        pick = next((f for f in cand if f["s"] != ultimo), cand[0])
        out.append({"id": secrets.token_hex(8), "subjectId": pick["s"], "duration": pick["sessoes"].pop(0)})
        ultimo = pick["s"]
    return out


# ───────────────────────────── vault ─────────────────────────────

def status_tarefa(v):
    """`status: done` ou em lista (`- done`, como o TaskNotes às vezes grava): o primeiro valor, em minúsculas"""
    if isinstance(v, list):
        v = next((x for x in v if x), None)
    return str(v or "open").strip().lower()


def wikilink_alvo(v):
    m = re.search(r"\[\[([^\]|#]+)", str(v or ""))
    return m.group(1).strip() if m else None


def ate_recorrencia(rrule):
    m = re.search(r"UNTIL=(\d{8})", str(rrule or ""))
    return f"{m.group(1)[:4]}-{m.group(1)[4:6]}-{m.group(1)[6:]}" if m else None


class Vault:
    def __init__(self, raiz):
        self.raiz = raiz
        self.acad = os.path.join(raiz, "System", "Academico")

    def semestre_ativo(self):
        pasta = os.path.join(self.acad, "Semestres")
        for f in sorted(os.listdir(pasta)):
            if not f.endswith(".md") or f.endswith(" Estudo.md"):
                continue
            fm, _, _ = ler_nota(os.path.join(pasta, f))
            if fm.get("type") == "semestre" and str(fm.get("status")) == "active":
                return f[:-3]
        raise SystemExit("nenhum semestre com status active em System/Academico/Semestres")

    def inicio_semestre(self, semestre):
        fm, _, _ = ler_nota(os.path.join(self.acad, "Semestres", f"{semestre}.md"))
        return str(fm.get("start") or "")[:10] or None

    def disciplinas(self, semestre):
        out = []
        base = os.path.join(self.acad, "Disciplinas")
        for pasta in sorted(os.listdir(base)):
            p = os.path.join(base, pasta)
            if not os.path.isdir(p):
                continue
            for f in os.listdir(p):
                if not f.endswith(".md"):
                    continue
                fm, _, _ = ler_nota(os.path.join(p, f))
                if fm.get("type") != "disciplina" or str(fm.get("semestre")) != semestre:
                    continue
                cod = str(fm["codigo"]).strip()
                out.append({
                    "cod": cod, "id": cod.lower(), "nome": f[:-3], "titulo": fm.get("disciplina") or f[:-3],
                    "pasta": p, "nota": os.path.join(p, f), "prioridade": str(fm.get("priority") or "normal"),
                    "natureza": str(fm.get("natureza") or "conteudo"), "fim": ate_recorrencia(fm.get("recurrence")),
                    "topicos": [t for t in (fm.get("conteudo_programatico") or []) if isinstance(t, dict) and t.get("id")],
                })
        return sorted(out, key=lambda d: d["cod"])

    def caminho_razao(self, d, semestre):
        return os.path.join(d["pasta"], f"{d['cod']} Estudo {semestre}.md")

    def caminho_estado(self, semestre):
        return os.path.join(self.acad, "Semestres", f"{semestre} Estudo.md")

    def fontes_de_tempo(self, discs, semestre):
        """Notas cujas `timeEntries` são estudo: a nota-razão e as tarefas acadêmicas com `class:`."""
        por_nome = {d["nome"]: d for d in discs}
        out = []
        for d in discs:
            for f in sorted(os.listdir(d["pasta"])):
                p = os.path.join(d["pasta"], f)
                if not f.endswith(".md") or not os.path.isfile(p):
                    continue
                if p == self.caminho_razao(d, semestre):
                    out.append((p, d))
                    continue
                with open(p, encoding="utf-8") as fh:
                    if "timeEntries" not in fh.read(20000):   # sem tempo registrado: nem abre o YAML
                        continue
                fm, _, _ = ler_nota(p)
                tags = fm.get("tags") or []
                alvo = wikilink_alvo(fm.get("class"))
                if "tipo/task" in (tags if isinstance(tags, list) else [tags]) and alvo in por_nome:
                    out.append((p, por_nome[alvo]))
        return out

    def tarefas(self, discs, semestre):
        """Tarefas acadêmicas (`tipo/task` com `class:` da disciplina). Viram tópicos no Coado para o relógio e o
        celular registrarem tempo direto nelas; o id do tópico é estável pelo caminho da nota."""
        por_nome = {d["nome"]: d for d in discs}
        out = []
        for d in discs:
            for f in sorted(os.listdir(d["pasta"])):
                p = os.path.join(d["pasta"], f)
                if not f.endswith(".md") or not os.path.isfile(p) or p == self.caminho_razao(d, semestre):
                    continue
                with open(p, encoding="utf-8") as fh:
                    if "tipo/task" not in fh.read(4000):
                        continue
                fm, _, _ = ler_nota(p)
                tags = fm.get("tags") or []
                if "tipo/task" not in (tags if isinstance(tags, list) else [tags]) or wikilink_alvo(fm.get("class")) != d["nome"]:
                    continue
                rel = os.path.relpath(p, self.raiz)
                out.append({"tid": f"{d['id']}_t{hashlib.sha1(rel.encode()).hexdigest()[:10]}", "path": p, "rel": rel, "d": d,
                            "titulo": str(fm.get("title") or f[:-3]), "status": status_tarefa(fm.get("status")),
                            "tipo": str(fm.get("type") or "tarefa").lower(), "prazo": str(fm.get("due_date") or "")})
        return out


# ───────────────────────────── avaliações ─────────────────────────────

DATA_BR = re.compile(r"(\d{2})/(\d{2})/(\d{4})")


def avaliacoes(vault, discs):
    """Datas de avaliação de cada disciplina: tabela da seção "Avaliações" da nota da disciplina
    (primeira data dd/mm/aaaa da linha) e tarefas `type: exame` com `due_date`. Mesma regra do painel."""
    out = []
    for d in discs:
        with open(d["nota"], encoding="utf-8") as f:
            corpo = f.read()
        dentro = False
        for linha in corpo.split("\n"):
            if re.match(r"^#+\s*Avalia", linha):
                dentro = True
                continue
            if dentro and linha.startswith("#"):
                break
            if not dentro or not linha.strip().startswith("|"):
                continue
            m = DATA_BR.search(linha)
            if not m:
                continue
            out.append({"cod": d["cod"], "data": f"{m.group(3)}-{m.group(2)}-{m.group(1)}"})
        for f in os.listdir(d["pasta"]):
            p = os.path.join(d["pasta"], f)
            if f.endswith(".md") and os.path.isfile(p):
                with open(p, encoding="utf-8") as fh:
                    if "type: exame" not in fh.read(3000):
                        continue
                fm, _, _ = ler_nota(p)
                if fm.get("type") == "exame" and fm.get("due_date"):
                    out.append({"cod": d["cod"], "data": str(fm["due_date"])[:10]})
    return out


# tipo da tarefa na vault -> tipo de avaliação no Coado; o que não está aqui (revisão, aula) não é avaliação
TIPO_AVALIACAO = {"tarefa": "trabalho", "projeto": "trabalho", "relatorio": "trabalho", "pratica": "trabalho",
                  "exame": "prova", "prova": "prova", "quiz": "lista", "questionario": "lista", "lista": "lista",
                  "apresentacao": "apresentacao", "seminario": "apresentacao"}
FECHADA = ("done", "cancelled", "concluido", "concluído")
PESO = re.compile(r"^\d+(?:[.,]\d+)?\s*%$")


def avaliacoes_coado(vault, discs, tarefas, hoje):
    """Avaliações do modo universidade do Coado, todas da vault: cada tarefa (mesmo id do tópico "Tarefa · …", para o
    estudo registrado nela voltar para a nota) e cada linha com data da tabela "Avaliações" da nota da disciplina. A
    linha que já tem nota de tarefa do mesmo tipo na mesma data fica só como a nota."""
    out = {}
    datas_tarefa = {}                                         # (disciplina, data) -> tipos das tarefas
    for t in tarefas:
        kind = TIPO_AVALIACAO.get(t["tipo"])
        data = t["prazo"][:10]
        if not kind or not re.match(r"^\d{4}-\d{2}-\d{2}$", data):
            continue
        hora = t["prazo"][11:16] if re.match(r"^\d{2}:\d{2}", t["prazo"][11:16]) else None
        cod = t["d"]["cod"]
        nome = t["titulo"][len(cod):].strip() if t["titulo"].startswith(cod) else t["titulo"]
        a = {"id": t["tid"], "subjectId": t["d"]["id"], "name": nome.replace("_", " ")[:300] or t["titulo"][:300], "kind": kind,
             "date": data, "done": t["status"] in FECHADA, "notes": ""}
        if hora:
            a["time"] = hora
        out[a["id"]] = a
        datas_tarefa.setdefault((t["d"]["id"], data), set()).add(kind)
    for d in discs:
        with open(d["nota"], encoding="utf-8") as f:
            corpo = f.read()
        dentro = False
        for linha in corpo.split("\n"):
            if re.match(r"^#+\s*Avalia", linha):
                dentro = True
                continue
            if dentro and linha.startswith("#"):
                break
            if not dentro or not linha.strip().startswith("|"):
                continue
            celulas = [c.strip() for c in linha.strip().strip("|").split("|")]
            com_data = next((c for c in celulas if DATA_BR.search(c)), None)
            if not com_data or com_data.lower().startswith("até"):    # "até 10/11": agregado das APS, que já são tarefas
                continue
            m = DATA_BR.search(com_data)
            data = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
            peso = next((c for c in celulas if PESO.match(c)), None)
            nome = next((re.sub(r"[*`]", "", c).strip() for c in celulas if c is not com_data and c is not peso and re.search(r"[A-Za-zÀ-ú]", c)), "Avaliação")
            kind = "prova" if re.search(r"prova|substitutiva|exame|\bP\d\b|\bPSub\b", nome, re.I) else "outro"
            ja = datas_tarefa.get((d["id"], data), set())
            if kind in ja or (kind == "outro" and ja):           # a tarefa já é essa avaliação
                continue
            chave = f"{d['cod']}|{nome}"                    # id estável pelo nome: mudar a data não recria a avaliação
            aid = f"{d['id']}_p{hashlib.sha1(chave.encode()).hexdigest()[:10]}"
            a = {"id": aid, "subjectId": d["id"], "name": nome[:300], "kind": kind, "date": data, "done": data < hoje, "notes": ""}
            if peso:
                a["weight"] = peso
            out[aid] = a
    return out


# ───────────────────────────── Anki ─────────────────────────────

def ler_anki(caminho, discs, inicio_sem):
    """Lê uma CÓPIA da coleção do Anki (nunca o arquivo dele). Devolve o resumo por disciplina e as
    sessões de revisão fechadas desde o início do semestre. Baralho -> disciplina pelo código no nome
    (Faculdade::ELT75A::Conceitos é da ELT75A)."""
    if not caminho or not os.path.exists(caminho):
        return None, []
    with tempfile.TemporaryDirectory() as tmp:
        copia = os.path.join(tmp, "c.anki2")
        for suf in ("", "-wal"):
            if os.path.exists(caminho + suf):
                shutil.copy2(caminho + suf, copia + suf)
        con = sqlite3.connect(copia)
        try:
            crt = con.execute("select crt from col").fetchone()[0]
            decks = con.execute("select id, name from decks").fetchall()
            cods = {d["cod"].upper(): d["cod"] for d in discs}
            deck_cod, deck_nome = {}, {}
            for did, nome in decks:
                partes = nome.split("\x1f")
                cod = next((cods[p.upper()] for p in partes if p.upper() in cods), None)
                if cod:
                    deck_cod[did] = cod
                    deck_nome.setdefault(cod, "::".join(partes[:partes.index(next(p for p in partes if p.upper() == cod.upper())) + 1]))
            agora = dt.datetime.now(TZ)
            hoje_idx = int((agora.timestamp() - crt) // 86400)
            vira = agora.replace(hour=4, minute=0, second=0, microsecond=0)        # o dia do Anki vira às 4h
            if agora < vira:
                vira -= dt.timedelta(days=1)
            ini_dia_ms, mes_ms = int(vira.timestamp() * 1000), int((agora - dt.timedelta(days=30)).timestamp() * 1000)
            resumo = {}
            for cid, did, odid, queue, due in con.execute("select id, did, odid, queue, due from cards"):
                cod = deck_cod.get(odid or did)
                if not cod:
                    continue
                r = resumo.setdefault(cod, {"baralho": deck_nome[cod], "cards": 0, "novos": 0, "para_hoje": 0, "suspensos": 0,
                                            "revisados_hoje": 0, "acertos_30d": 0, "revisoes_30d": 0, "ultima_revisao": None})
                r["cards"] += 1
                if queue == 0:
                    r["novos"] += 1
                elif queue < 0:
                    r["suspensos"] += 1
                elif (queue in (2, 3) and due <= hoje_idx) or (queue == 1 and due <= agora.timestamp() + 1200):
                    r["para_hoje"] += 1
            cartas = {cid: deck_cod.get(odid or did) for cid, did, odid in con.execute("select id, did, odid from cards")}
            inicio_ms = int(dt.datetime.strptime(inicio_sem, "%Y-%m-%d").replace(tzinfo=TZ).timestamp() * 1000)
            por_cod = {}
            for rid, cid, ease, tempo in con.execute("select id, cid, ease, time from revlog where id >= ? order by id", (min(inicio_ms, mes_ms),)):
                cod = cartas.get(cid)
                if not cod:
                    continue
                r = resumo[cod]
                if rid >= ini_dia_ms:
                    r["revisados_hoje"] += 1
                if rid >= mes_ms:
                    r["revisoes_30d"] += 1
                    r["acertos_30d"] += 1 if ease > 1 else 0
                r["ultima_revisao"] = dt.datetime.fromtimestamp(rid / 1000, TZ).strftime("%Y-%m-%d")
                if rid >= inicio_ms:
                    por_cod.setdefault(cod, []).append((rid, ease, min(tempo, 60000)))
        finally:
            con.close()
    sessoes, agora_ms = [], int(dt.datetime.now(TZ).timestamp() * 1000)
    for cod, revs in por_cod.items():
        grupo = []
        for rev in revs + [None]:
            if grupo and (rev is None or rev[0] - grupo[-1][0] > ANKI_PAUSA_MS):
                if agora_ms - grupo[-1][0] > ANKI_PAUSA_MS:           # sessão ainda aberta fica para depois
                    sessoes.append({"cod": cod, "inicio_ms": grupo[0][0], "seg": round(sum(x[2] for x in grupo) / 1000),
                                    "cards": len(grupo), "erros": sum(1 for x in grupo if x[1] == 1)})
                grupo = []
            if rev:
                grupo.append(rev)
    return resumo, sessoes


# ───────────────────────────── forma canônica ─────────────────────────────

def iso_utc(local_dt):
    return local_dt.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{local_dt.microsecond // 1000:03d}Z"


def parse_iso(s):
    return dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))


def estudo_da_entrada(e, disc):
    ini, fim = parse_iso(e["startTime"]), parse_iso(e["endTime"])
    loc = ini.astimezone(TZ)
    cat_padrao = "execucao" if disc["natureza"] == "execucao" else "teoria"
    return {
        "subj": disc["id"], "topic": e.get("topico") or None, "assess": e.get("avaliacao") or None, "cat": e.get("categoria") or cat_padrao,
        "date": loc.strftime("%Y-%m-%d"), "time": loc.strftime("%H:%M"),
        "dur": int(round((fim - ini).total_seconds())),
        "hits": max(0, int(e.get("acertos") or 0)), "misses": max(0, int(e.get("erros") or 0)),
        "plan": bool(e.get("ciclo", True)), "material": str(e.get("material") or "")[:1000],
        "comment": str(e.get("comentario") or "")[:20000],
    }


def estudo_do_coado(s):
    return {"subj": s["subjectId"], "topic": s.get("topicId") or None, "assess": s.get("assessmentId") or None, "cat": s["categoryId"], "date": s["date"],
            "time": s.get("time") or "00:00", "dur": int(s["duration"]), "hits": s["hits"], "misses": s["misses"],
            "plan": bool(s["countInPlanning"]), "material": s.get("material") or "", "comment": s.get("comment") or ""}


def nome_categoria(cat):
    return next((n for i, n, _ in CATEGORIAS if i == cat), cat)


def entrada_do_estudo(sid, c, topicos, entrada_antiga=None):
    """Entrada de `timeEntries` no formato do TaskNotes, com os campos do estudo ao lado."""
    ini = dt.datetime.strptime(f"{c['date']} {c['time']}", "%Y-%m-%d %H:%M").replace(tzinfo=TZ)
    if entrada_antiga:   # mesma data e minuto: preserva os segundos que o cronômetro gravou
        velho = parse_iso(entrada_antiga["startTime"]).astimezone(TZ)
        if velho.strftime("%Y-%m-%d %H:%M") == ini.strftime("%Y-%m-%d %H:%M"):
            ini = velho
    fim = ini + dt.timedelta(seconds=c["dur"])
    desc = " · ".join(x for x in [nome_categoria(c["cat"]), topicos.get(c["topic"] or "", "")] if x)
    e = {"startTime": iso_utc(ini), "description": desc or "Estudo", "endTime": iso_utc(fim), "coado": sid,
         "categoria": c["cat"]}
    if c["topic"]:
        e["topico"] = c["topic"]
    if c.get("assess"):
        e["avaliacao"] = c["assess"]
    if c["hits"] or c["misses"]:
        e["acertos"], e["erros"] = c["hits"], c["misses"]
    if not c["plan"]:
        e["ciclo"] = False
    if c["material"]:
        e["material"] = c["material"]
    if c["comment"]:
        e["comentario"] = c["comment"]
    return e


def planejamento_da_vault(p):
    if not p:
        return None
    return {"type": "weekly" if p.get("tipo") == "semanal" else "cycle", "weeklyMinutes": int(p.get("minutos_semana", 0)),
            "days": [bool(x) for x in p.get("dias", [False] * 7)], "minSession": int(p.get("sessao_min", 30)),
            "maxSession": int(p.get("sessao_max", 120)),
            "subjects": sorted([{"s": str(x["codigo"]).lower(), "imp": float(x["importancia"]), "know": float(x["conhecimento"])}
                                for x in p.get("disciplinas", [])], key=lambda x: x["s"]),
            "cycle": [{"id": str(x["id"]), "s": str(x["codigo"]).lower(), "dur": int(x["minutos"])} for x in p.get("ciclo", [])],
            "completed": int(p.get("ciclos_completos", 0)), "started": str(p.get("inicio_ciclo"))}


def planejamento_do_coado(p):
    if not p:
        return None
    c = p["config"]
    return {"type": p["type"], "weeklyMinutes": c["weeklyMinutes"], "days": c["days"], "minSession": c["minSession"],
            "maxSession": c["maxSession"],
            "subjects": sorted([{"s": x["subjectId"], "imp": float(x["importance"]), "know": float(x["knowledge"])} for x in c["subjects"]],
                               key=lambda x: x["s"]),
            "cycle": [{"id": x["id"], "s": x["subjectId"], "dur": x["duration"]} for x in p["cycle"]],
            "completed": p["completedCycles"], "started": p["cycleStartedAt"]}


def num(v):
    return int(v) if float(v).is_integer() else float(v)


def planejamento_para_vault(c):
    return {"tipo": "semanal" if c["type"] == "weekly" else "ciclo", "minutos_semana": c["weeklyMinutes"], "dias": c["days"],
            "sessao_min": c["minSession"], "sessao_max": c["maxSession"],
            "disciplinas": [{"codigo": x["s"].upper(), "importancia": num(x["imp"]), "conhecimento": num(x["know"])} for x in c["subjects"]],
            "ciclo": [{"id": x["id"], "codigo": x["s"].upper(), "minutos": x["dur"]} for x in c["cycle"]],
            "ciclos_completos": c["completed"], "inicio_ciclo": c["started"]}


def planejamento_para_coado(c, plano):
    return {"planId": plano, "type": c["type"],
            "config": {"weeklyMinutes": c["weeklyMinutes"], "days": c["days"], "minSession": c["minSession"], "maxSession": c["maxSession"],
                       "subjects": [{"subjectId": x["s"], "importance": x["imp"], "knowledge": x["know"]} for x in c["subjects"]]},
            "cycle": [{"id": x["id"], "subjectId": x["s"], "duration": x["dur"]} for x in c["cycle"]],
            "completedCycles": c["completed"], "cycleStartedAt": c["started"]}


# ───────────────────────────── Coado ─────────────────────────────

class Coado:
    def __init__(self, url, token):
        self.url, self.token = url.rstrip("/"), token

    def _req(self, metodo, rota, corpo=None):
        dados = json.dumps(corpo).encode() if corpo is not None else None
        r = urllib.request.Request(self.url + "/api" + rota, data=dados, method=metodo, headers={
            "Authorization": f"Bearer {self.token}", "X-Coado-Request": "1", "content-type": "application/json"})
        try:
            with urllib.request.urlopen(r, timeout=8) as resp:
                return json.loads(resp.read() or b"null")
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{metodo} {rota}: {e.code} {e.read()[:400]!r}") from None

    def estado(self):
        return self._req("GET", "/state")

    def sync(self, lote):
        return self._req("POST", "/sync", lote)


# ───────────────────────────── merge em três vias ─────────────────────────────

def mesclar_mapa(base, vault, coado, nome, log):
    """Por chave: igual nos dois = nada; mudou só de um lado = vale esse lado; os dois = vence a vault."""
    res = {}
    for k in set(base) | set(vault) | set(coado):
        b, v, c = base.get(k), vault.get(k), coado.get(k)
        if v == c:
            r = v
        elif v == b:
            r = c
        elif c == b:
            r = v
        else:
            r = v
            log.append(f"conflito em {nome} {k}: valeu a vault")
        if r is not None:
            res[k] = r
    return res


def mesclar_conjunto(base, vault, coado):
    b, v, c = set(base), set(vault), set(coado)
    return sorted((b | (v - b) | (c - b)) - (b - v) - (b - c))


def mesclar_valor(base, vault, coado, nome, log):
    return mesclar_mapa({"x": base} if base is not None else {}, {"x": vault} if vault is not None else {},
                        {"x": coado} if coado is not None else {}, nome, log).get("x")


# ───────────────────────────── rodada ─────────────────────────────

def ler_config(caminho):
    cfg = {}
    for linha in open(os.path.expanduser(caminho), encoding="utf-8"):
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            k, v = linha.split("=", 1)
            cfg[k.strip()] = v.strip()
    return cfg


def estado_inicial(discs, semestre):
    """Nota de estado do semestre na primeira vez: pesos neutros, ciclo gerado pelo algoritmo do Coado.
    O total de 960 min é o das horas de disciplina da grade de 29/08 (16h10 por semana, arredondado)."""
    peso = {"high": 4, "normal": 2, "low": 1}
    subs = [{"subjectId": d["id"], "importance": peso.get(d["prioridade"], 2), "knowledge": 2.5} for d in discs]
    cfg = {"weeklyMinutes": 960, "minSession": 30, "maxSession": 90, "subjects": subs}
    hoje = dt.datetime.now(TZ).strftime("%Y-%m-%d")
    plan = {"type": "cycle", "weeklyMinutes": 960, "days": [False, True, True, True, True, True, False], "minSession": 30,
            "maxSession": 90, "subjects": sorted([{"s": s["subjectId"], "imp": float(s["importance"]), "know": 2.5} for s in subs], key=lambda x: x["s"]),
            "cycle": [{"id": c["id"], "s": c["subjectId"], "dur": c["duration"]} for c in gerar_ciclo(cfg)],
            "completed": 0, "started": hoje}
    return {
        "cssclasses": ["noyaml", "dashboard", "wide-page"],
        "semestre": f"[[{semestre}]]",
        "coado_plano": f"utfpr-{semestre}",
        "data_prova": None,
        "meta_semanal": {"minutos": 960, "questoes": 0},
        "intervalos_revisao": [1, 7, 30],
        "cores": {d["cod"]: PALETA[i % len(PALETA)] for i, d in enumerate(discs)},
        "planejamento": planejamento_para_vault(plan),
        "topicos_concluidos": [],
        "revisoes": [],
    }


CORPO_ESTADO = """
```datacorejsx
const { PainelEstudo } = await dc.require(dc.fileLink("System/Scripts/Widgets/dc-coadoPainel.jsx"));
return <PainelEstudo />;
```
"""


def nova_razao(d, semestre):
    hoje = dt.datetime.now(TZ).strftime("%Y-%m-%d")
    fm = {"tags": ["tipo/task", "academico"], "class": f"[[{d['nome']}]]", "type": "tarefa", "status": "in-progress",
          "priority": d["prioridade"], "due_date": d["fim"], "created": hoje, "coado_disciplina": d["id"], "timeEntries": []}
    corpo = f"\n# {d['cod']}: estudo do semestre {semestre}\n\nCada sessão de estudo da disciplina é uma entrada de tempo desta nota, venha do pomodoro, do relógio ou do Coado.\n"
    return fm, corpo


def iniciar(vault, semestre, discs, seco, log, so_razoes=False):
    for d in discs:
        p = vault.caminho_razao(d, semestre)
        if os.path.exists(p):
            continue
        log.append(f"criar nota-razão {os.path.relpath(p, vault.raiz)}")
        if not seco:
            gravar_nota(p, *nova_razao(d, semestre))
    if so_razoes:
        return
    p = vault.caminho_estado(semestre)
    if not os.path.exists(p):
        log.append(f"criar nota de estado {os.path.relpath(p, vault.raiz)}")
        if not seco:
            gravar_nota(p, estado_inicial(discs, semestre), f"\n# Estudo {semestre}\n" + CORPO_ESTADO)


def id_derivado(prefixo, rel, inicio):
    return prefixo + hashlib.sha1(f"{rel}|{inicio}".encode()).hexdigest()[:15]


def com_fantasmas(base, real, confirmados):
    """Item da base que nunca foi visto na vault (a ponte gravou e ainda não leu de volta) não está
    "apagado": pode ter sido sobrescrito por outro programa, ou a gravação foi adiada. Entra na
    mesclagem com o valor da base, para ser regravado em vez de virar exclusão."""
    v, fantasmas = dict(real), set()
    for k, b in base.items():
        if k not in real and k not in confirmados:
            v[k] = b
            fantasmas.add(k)
    return v, fantasmas


def rodada(args):
    cfg = ler_config(args.config)
    nome = cfg.get("NOME", "padrao")
    vault, coado = Vault(cfg["VAULT"]), Coado(cfg["COADO_URL"], cfg["COADO_TOKEN"])
    log, mudancas = [], []
    semestre = vault.semestre_ativo()
    discs = vault.disciplinas(semestre)
    if not discs:
        raise SystemExit(f"nenhuma disciplina do semestre {semestre}")
    if args.init:                                             # só cria o que falta e sai
        iniciar(vault, semestre, discs, args.seco, log)
        print("\n".join(log) or "nada a criar")
        return
    iniciar(vault, semestre, discs, args.seco, log, so_razoes=True)   # disciplina nova ganha a nota-razão
    inicio_sem = vault.inicio_semestre(semestre) or "1970-01-01"
    plano = f"utfpr-{semestre}"
    por_id = {d["id"]: d for d in discs}
    nomes_topico = {f"{d['id']}_{t['id']}": str(t.get("nome") or t["id"]).rstrip(".") for d in discs for t in d["topicos"]}
    # tarefas viram tópicos ("Tarefa · …"): estudo registrado nelas no relógio ou no celular vai para dentro da tarefa
    tarefas = vault.tarefas(discs, semestre)
    tarefa_por_tid = {t["tid"]: t for t in tarefas}
    tarefa_por_caminho = {t["path"]: t["tid"] for t in tarefas}
    caminhos_tarefa = {t["path"] for t in tarefas}
    topicos_validos = {**nomes_topico, **{t["tid"]: f"Tarefa · {t['titulo']}" for t in tarefas}}
    base_path = os.path.join(STATE_DIR, f"coado_ponte-{nome}.json")
    base = json.load(open(base_path)) if os.path.exists(base_path) else {}
    base_est, base_rev = base.get("studies") or {}, base.get("reviews") or {}
    base_est = {k: {"assess": None, **v} for k, v in base_est.items()}      # base de antes do modo universidade
    # base antiga, sem registro de confirmação: o que ela tem já foi visto na vault
    conf = base.get("confirmados") or {"studies": list(base_est), "reviews": list(base_rev)}

    # ── Anki: cada sessão de revisão fechada vira estudo na nota-razão (uma vez só)
    anki_resumo, anki_sessoes = ler_anki(os.path.expanduser(cfg.get("ANKI_COLECAO", ANKI_PADRAO)), discs, inicio_sem)
    importados = set(base.get("anki_importados") or [])
    novos_anki = []
    for s in anki_sessoes:
        d = next(x for x in discs if x["cod"] == s["cod"])
        sid = id_derivado("a", s["cod"], s["inicio_ms"])
        if sid in importados:
            continue
        if s["seg"] < MIN_SEGUNDOS:                              # menos de 1 min: abaixo do corte de tudo o mais
            importados.add(sid)
            continue
        caminho = vault.caminho_razao(d, semestre)
        fm, corpo, mt = ler_nota(caminho)
        lista = fm.get("timeEntries") or []
        if any(isinstance(e, dict) and e.get("coado") == sid for e in lista):
            importados.add(sid)
            continue
        if any(isinstance(e, dict) and e.get("startTime") and not e.get("endTime") for e in lista):
            continue                                              # cronômetro rodando: a próxima rodada importa
        ini = dt.datetime.fromtimestamp(s["inicio_ms"] / 1000, TZ)
        entrada = {"startTime": iso_utc(ini), "description": f"Anki · {s['cards']} cards", "endTime": iso_utc(ini + dt.timedelta(seconds=s["seg"])),
                   "coado": sid, "categoria": "revisao", "acertos": s["cards"] - s["erros"], "erros": s["erros"], "fonte": "anki"}
        fm["timeEntries"] = sorted(lista + [entrada], key=lambda e: str(e.get("startTime")))
        novos_anki.append((caminho, fm, corpo, mt, sid))
        mudancas.append(f"Anki→vault: {s['cod']} {ini:%Y-%m-%d %H:%M} {s['cards']} cards, {s['seg'] // 60} min")
    if not args.seco:
        for caminho, fm, corpo, mt, sid in novos_anki:
            gravar_nota(caminho, fm, corpo, mt)
            importados.add(sid)

    # ── vault: estudos (com localização) e nota de estado
    arquivos = {}                 # caminho -> [fm, corpo, mtime (None = nota nova)]
    v_real, onde, sem_id, so_vault = {}, {}, [], set()
    for caminho, d in vault.fontes_de_tempo(discs, semestre):
        fm, corpo, mt = ler_nota(caminho)
        arquivos[caminho] = [fm, corpo, mt]
        razao = caminho == vault.caminho_razao(d, semestre)
        rel = os.path.relpath(caminho, vault.raiz)
        for i, e in enumerate(fm.get("timeEntries") or []):
            if not isinstance(e, dict) or not e.get("startTime") or not e.get("endTime"):
                continue
            if e.get("confirmado") is False:
                continue
            try:
                c = estudo_da_entrada(e, d)
            except Exception:
                log.append(f"entrada ilegível em {rel}")
                continue
            if c["dur"] < MIN_SEGUNDOS or c["date"] < inicio_sem:
                continue
            if not razao and e.get("fonte") == "coado" and e.get("coado") and ID_OK.match(str(e["coado"])):
                sid = str(e["coado"])     # estudo do Coado que a ponte gravou na tarefa: é dela, pode mudar e sair
            elif not razao:           # tarefa do Davi: a ponte não escreve nela
                sid = id_derivado("t", rel, e["startTime"])
                so_vault.add(sid)
            elif e.get("coado") and ID_OK.match(str(e["coado"])):
                sid = str(e["coado"])
            else:                     # sessão nova (pomodoro): id estável, igual em toda rodada
                sid = id_derivado("v", rel, e["startTime"])
                sem_id.append((caminho, i, sid))
            if sid in v_real:
                log.append(f"id repetido {sid} em {rel}: vale a primeira entrada")
                continue
            if not razao and caminho in tarefa_por_caminho and not c["assess"]:
                c["assess"] = tarefa_por_caminho[caminho]        # o lugar já diz a avaliação
            v_real[sid] = c
            onde[sid] = caminho
    estado_p = vault.caminho_estado(semestre)
    if not os.path.exists(estado_p):
        raise SystemExit("nota de estado ausente: rode com --init")
    efm, ecorpo, emt = ler_nota(estado_p)
    estado_mudou = False
    # a "data da prova" do Coado é a próxima avaliação real do semestre (a vault é dona)
    hoje = dt.datetime.now(TZ).strftime("%Y-%m-%d")
    proxima = min((a["data"] for a in avaliacoes(vault, discs) if a["data"] >= hoje), default=None)
    if (str(efm.get("data_prova"))[:10] if efm.get("data_prova") else None) != proxima:
        efm["data_prova"] = proxima
        estado_mudou = True
    if anki_resumo is not None:
        velho = {k: v for k, v in (efm.get("anki") or {}).items() if k != "atualizado"}
        if velho != anki_resumo:
            efm["anki"] = {**anki_resumo, "atualizado": dt.datetime.now(TZ).isoformat(timespec="minutes")}
            estado_mudou = True
    v_rev_real = {str(r["id"]): {"study": str(r["estudo"]), "subj": str(r["disciplina"]).lower(), "topic": r.get("topico") or None,
                                 "due": str(r["vence"])[:10], "interval": int(r["intervalo"]), "status": STATUS_V2C.get(r.get("status"), "pending"),
                                 "doneAt": r.get("feita_em") or None}
                  for r in (efm.get("revisoes") or []) if isinstance(r, dict) and r.get("id") and ID_OK.match(str(r["id"]))}
    v_plan = planejamento_da_vault(efm.get("planejamento"))
    v_top = sorted(str(x) for x in (efm.get("topicos_concluidos") or []) if str(x) in nomes_topico)
    v_meta = {"minutes": int((efm.get("meta_semanal") or {}).get("minutos", 0)), "questions": int((efm.get("meta_semanal") or {}).get("questoes", 0)),
              "exam": str(efm["data_prova"])[:10] if efm.get("data_prova") else None, "intervals": [int(x) for x in (efm.get("intervalos_revisao") or [])]}

    # ── Coado
    st = coado.estado()
    c_subjects = {s["id"] for s in st["subjects"] if s["planId"] == plano}
    ids_coado = {s["id"] for s in st["studies"]}
    # estudo de disciplina que só existe no Coado: fica lá, fora da sincronização
    c_real = {s["id"]: estudo_do_coado(s) for s in st["studies"] if s["planId"] == plano and s["subjectId"] in por_id}
    c_estudos = dict(c_real)
    # disciplina apagada no Coado leva os estudos junto (cascata); isso não pode virar exclusão na vault
    ausentes = set(por_id) - c_subjects
    for sid, b in base_est.items():
        if b["subj"] in ausentes and sid not in c_estudos:
            c_estudos[sid] = b
    c_rev = {r["id"]: {"study": r["studyId"], "subj": r["subjectId"], "topic": r.get("topicId") or None, "due": r["dueDate"],
                       "interval": r["interval"], "status": r["status"], "doneAt": r.get("doneAt") or None}
             for r in st["reviews"] if r["planId"] == plano and r["subjectId"] in por_id}
    c_plan = planejamento_do_coado(st["plannings"].get(plano))
    c_top = sorted(t["id"] for t in st["topics"] if t["finished"] and t["id"] in nomes_topico)
    c_plano = next((p for p in st["plans"] if p["id"] == plano), None)
    c_meta = {"minutes": c_plano["weeklyGoal"]["minutes"], "questions": c_plano["weeklyGoal"]["questions"],
              "exam": c_plano.get("examDate"), "intervals": st["reviewIntervals"]} if c_plano else None
    # modo universidade: só com Coado que conhece avaliações (a API antiga nem devolve a coleção)
    universidade = "assessments" in st
    r_aval = avaliacoes_coado(vault, discs, tarefas, hoje) if universidade else {}
    da_ponte = re.compile(r"^(" + "|".join(re.escape(d["id"]) for d in discs) + r")_[tp][0-9a-f]{10}$")
    c_aval = {a["id"]: a for a in st.get("assessments", []) if a["planId"] == plano}
    aval_validas = set(r_aval) | {k for k in c_aval if not da_ponte.match(k)}      # as criadas no Coado também valem

    # entrada digitada à mão com tópico ou categoria que o Coado não conhece: normaliza, senão o lote inteiro é recusado
    cats = {i for i, _, _ in CATEGORIAS} | {c["id"] for c in st["categories"]}
    for sid, c in v_real.items():
        if c["topic"] and c["topic"] not in topicos_validos:
            c["topic"] = None
        if c["assess"] and c["assess"] not in aval_validas:
            c["assess"] = None
        if c["cat"] not in cats or not ID_OK.match(c["cat"]):
            c["cat"] = "execucao" if por_id[c["subj"]]["natureza"] == "execucao" else "teoria"
    for r in v_rev_real.values():
        if r["topic"] and r["topic"] not in topicos_validos:
            r["topic"] = None

    # ── três vias
    v_est, fant_est = com_fantasmas(base_est, v_real, set(conf.get("studies", [])))
    v_rev, fant_rev = com_fantasmas(base_rev, v_rev_real, set(conf.get("reviews", [])))
    r_estudos = mesclar_mapa(base_est, v_est, c_estudos, "estudo", log)
    for sid in so_vault:                                     # estudo de tarefa só se edita na vault
        if r_estudos.get(sid) != v_real[sid]:
            log.append(f"estudo {sid} vem de uma tarefa: vale a vault")
            r_estudos[sid] = v_real[sid]
    r_estudos = {k: ({**v, "assess": None} if v.get("assess") and v["assess"] not in aval_validas else v)
                 for k, v in r_estudos.items() if v["subj"] in por_id}
    r_rev = mesclar_mapa(base_rev, v_rev, c_rev, "revisão", log)
    r_plan = mesclar_valor(base.get("planning"), v_plan, c_plan, "planejamento", log)
    r_top = mesclar_conjunto(base.get("topics_done") or [], v_top, c_top)
    r_meta = mesclar_valor(base.get("goals"), v_meta, c_meta, "metas", log) or v_meta
    r_meta = {**r_meta, "exam": v_meta["exam"]}      # a data vem das avaliações da vault; mudança no Coado é desfeita
    regravar = [k for k in fant_est if k in r_estudos]
    if regravar:
        log.append(f"regravando {len(regravar)} estudo(s) que a vault ainda não tinha: {', '.join(regravar)}")

    # trava contra apagão nos dois sentidos (Coado zerado, conta errada, notas-razão apagadas)
    apagar_v = [k for k in v_real if k not in r_estudos]
    apagar_c = [k for k in c_real if k not in r_estudos]
    if len(apagar_v) > max(5, len(v_real) * 0.3):
        raise SystemExit(f"recusado: a rodada apagaria {len(apagar_v)} de {len(v_real)} estudos da vault")
    if len(apagar_c) > max(5, len(c_real) * 0.3):
        raise SystemExit(f"recusado: a rodada apagaria {len(apagar_c)} de {len(c_real)} estudos do Coado")

    # ── aplicar na vault
    toques = {}                                               # estudo -> notas que a aplicação dele mexe
    sujos = set()

    def tocar(sid, caminho):
        toques.setdefault(sid, set()).add(caminho)
        sujos.add(caminho)

    def nota(caminho, d):
        if caminho not in arquivos:
            if os.path.exists(caminho):
                arquivos[caminho] = list(ler_nota(caminho))
            else:                                             # nota-razão ainda não existe (modo seco)
                arquivos[caminho] = [*nova_razao(d, semestre), None]
        return arquivos[caminho][0]

    def tirar(fm, sid):
        lista = fm.get("timeEntries") or []
        achada = next((e for e in lista if isinstance(e, dict) and str(e.get("coado")) == sid), None)
        fm["timeEntries"] = [e for e in lista if e is not achada]
        return achada

    for caminho, i, sid in sem_id:                          # sessão nova da vault grava o id
        if sid in r_estudos:
            arquivos[caminho][0]["timeEntries"][i]["coado"] = sid
            tocar(sid, caminho)
    for sid in apagar_v:
        tirar(arquivos[onde[sid]][0], sid)
        tocar(sid, onde[sid])
        mudancas.append(f"Coado→vault: apagado {sid}")
    for sid, c in r_estudos.items():
        if v_real.get(sid) == c:
            continue
        d = por_id[c["subj"]]
        antiga = None
        alvo = tarefa_por_tid.get(c["topic"] or "") or tarefa_por_tid.get(c.get("assess") or "")
        if alvo and alvo["d"]["id"] == c["subj"]:
            destino = alvo["path"]                            # tópico ou avaliação de tarefa: o tempo mora na tarefa
        elif sid in onde and v_real[sid]["subj"] == c["subj"] and not (onde[sid] in caminhos_tarefa and sid not in so_vault):
            destino = onde[sid]
        else:
            destino = vault.caminho_razao(d, semestre)
        if sid in onde:                                       # tira do lugar atual (pode ser outra nota)
            antiga = tirar(nota(onde[sid], d), sid)
            tocar(sid, onde[sid])
        nova = entrada_do_estudo(sid, c, topicos_validos, antiga)
        if destino in caminhos_tarefa:
            nova["fonte"] = "coado"                           # marca o que a ponte mantém dentro da tarefa
        if antiga:                                            # campos do TaskNotes que não são do estudo ficam
            for k, v in antiga.items():
                if k not in nova and k not in ("topico", "avaliacao", "acertos", "erros", "ciclo", "material", "comentario"):
                    nova[k] = v
        fm_d = nota(destino, d)
        fm_d["timeEntries"] = sorted((fm_d.get("timeEntries") or []) + [nova], key=lambda e: str(e.get("startTime")))
        tocar(sid, destino)
        mudancas.append(f"Coado→vault: {'atualizado' if sid in v_real else 'novo'} {c['subj'].upper()} {c['date']} {c['dur'] // 60} min")
    if r_rev != v_rev_real:
        efm["revisoes"] = [{"id": k, "estudo": r["study"], "disciplina": r["subj"].upper(), "topico": r["topic"], "vence": r["due"],
                            "intervalo": r["interval"], "status": STATUS_C2V[r["status"]], "feita_em": r["doneAt"]}
                           for k, r in sorted(r_rev.items(), key=lambda kv: (kv[1]["due"], kv[0]))]
        estado_mudou = True
    if r_plan and r_plan != v_plan:
        efm["planejamento"] = planejamento_para_vault(r_plan)
        estado_mudou = True
    if r_top != v_top:
        efm["topicos_concluidos"] = r_top
        estado_mudou = True
    if r_meta != v_meta:
        efm["meta_semanal"] = {"minutos": r_meta["minutes"], "questoes": r_meta["questions"]}
        efm["data_prova"] = r_meta["exam"]
        efm["intervalos_revisao"] = r_meta["intervals"]
        estado_mudou = True
    if estado_mudou:
        mudancas.append("Coado→vault: nota de estado")

    # ── aplicar no Coado: catálogo + diferenças
    agora = dt.datetime.now(dt.timezone.utc).isoformat()
    cores = efm.get("cores") or {}
    up = {k: [] for k in ("categories", "plans", "subjects", "topics", "assessments", "studies", "reviews", "plannings")}
    c_cat = {c["id"]: c for c in st["categories"]}
    for i, n, b in CATEGORIAS:
        if i not in c_cat or c_cat[i]["name"] != n:
            up["categories"].append({"id": i, "name": n, "builtin": b} if b else {"id": i, "name": n})
    plano_obj = {"id": plano, "name": f"UTFPR {semestre.replace('-', '/')}", "org": "UTFPR", "notes": "Sincronizado com a vault",
                 "weeklyGoal": {"minutes": r_meta["minutes"], "questions": r_meta["questions"]},
                 "createdAt": c_plano["createdAt"] if c_plano else agora}
    if r_meta["exam"]:
        plano_obj["examDate"] = r_meta["exam"]          # o relógio antigo ainda conta até a próxima prova por aqui
    if universidade:
        plano_obj["kind"] = "universidade"
    if c_plano != plano_obj:
        up["plans"].append(plano_obj)
    c_sub = {s["id"]: s for s in st["subjects"]}
    c_topicos = {t["id"]: t for t in st["topics"]}
    topicos_usados = {c["topic"] for c in r_estudos.values() if c.get("topic")}
    nome_vault = urllib.parse.quote(os.path.basename(vault.raiz))
    for ordem, d in enumerate(discs):
        s = {"id": d["id"], "planId": plano, "name": f"{d['cod']} {d['titulo']}", "color": cores.get(d["cod"], PALETA[ordem % len(PALETA)]), "order": ordem}
        if {k: c_sub.get(d["id"], {}).get(k) for k in s} != s or c_sub.get(d["id"], {}).get("archived"):
            up["subjects"].append(s)
        link = f"obsidian://open?vault={nome_vault}&file={urllib.parse.quote(os.path.relpath(d['nota'], vault.raiz))}"
        for t in d["topicos"]:
            tid = f"{d['id']}_{t['id']}"
            fim = tid in r_top
            velho = c_topicos.get(tid, {})
            obj = {"id": tid, "subjectId": d["id"], "name": str(t.get("nome") or t["id"]).rstrip("."), "order": int(t.get("aula") or 0),
                   "finished": fim, "links": [{"title": d["nome"], "url": link}]}
            if fim:
                obj["finishedAt"] = velho.get("finishedAt") or agora
            if {k: velho.get(k) for k in obj} != obj:
                up["topics"].append(obj)
        for k_t, t in enumerate(x for x in tarefas if x["d"]["id"] == d["id"]):
            fim = t["status"] in ("done", "cancelled", "concluido", "concluído")
            if fim and t["tid"] not in topicos_usados and t["tid"] not in c_topicos:
                continue                                      # tarefa fechada e nunca usada: fora da lista do relógio
            velho = c_topicos.get(t["tid"], {})
            obj = {"id": t["tid"], "subjectId": d["id"], "name": f"Tarefa · {t['titulo']}"[:1000], "order": 1000 + k_t, "finished": fim,
                   "links": [{"title": t["titulo"][:300], "url": f"obsidian://open?vault={nome_vault}&file={urllib.parse.quote(t['rel'])}"}]}
            if fim:
                obj["finishedAt"] = velho.get("finishedAt") or agora
            if {k: velho.get(k) for k in obj} != obj:
                up["topics"].append(obj)
    # avaliações: a vault manda no nome, tipo, data e conclusão; nota e observações dadas no Coado ficam
    for aid, a in r_aval.items():
        velho = c_aval.get(aid, {})
        obj = {**a, "planId": plano, "createdAt": velho.get("createdAt") or agora}
        for k in ("grade", "maxGrade"):
            if velho.get(k) is not None:
                obj[k] = velho[k]
        if velho.get("notes"):
            obj["notes"] = velho["notes"]
        chaves = set(obj) | {k for k in ("time", "weight") if velho.get(k) is not None}
        if any(obj.get(k) != velho.get(k) for k in chaves):
            up["assessments"].append(obj)
    for sid, c in r_estudos.items():
        if c_estudos.get(sid) != c or sid not in ids_coado:
            up["studies"].append({"id": sid, "planId": plano, "subjectId": c["subj"], **({"topicId": c["topic"]} if c["topic"] else {}),
                                  **({"assessmentId": c["assess"]} if c.get("assess") else {}),
                                  "categoryId": c["cat"], "date": c["date"], "time": c["time"], "duration": c["dur"], "material": c["material"],
                                  "hits": c["hits"], "misses": c["misses"], "pages": [], "videos": [], "comment": c["comment"],
                                  "countInPlanning": c["plan"], "createdAt": agora})
    for rid, r in r_rev.items():
        if c_rev.get(rid) != r and r["study"] in r_estudos:
            obj = {"id": rid, "planId": plano, "studyId": r["study"], "subjectId": r["subj"], "dueDate": r["due"], "interval": r["interval"], "status": r["status"]}
            if r["topic"]:
                obj["topicId"] = r["topic"]
            if r["doneAt"]:
                obj["doneAt"] = r["doneAt"]
            up["reviews"].append(obj)
    dele = {"studies": apagar_c, "reviews": [k for k in c_rev if k not in r_rev],
            "assessments": [k for k in c_aval if da_ponte.match(k) and k not in r_aval]}
    if r_plan and r_plan != c_plan:
        up["plannings"].append(planejamento_para_coado(r_plan, plano))
    lote = {"upserts": {k: v for k, v in up.items() if v}, "deletes": {k: v for k, v in dele.items() if v}}
    ajustes = {}
    if st.get("activePlanId") != plano:
        ajustes["activePlanId"] = plano
    if r_meta["intervals"] and st.get("reviewIntervals") != r_meta["intervals"]:
        ajustes["reviewIntervals"] = r_meta["intervals"]
    if ajustes:
        lote["settings"] = ajustes
    lote = {k: v for k, v in lote.items() if v}
    if lote:
        partes = [f"{k} {len(v)}" for k, v in lote.get("upserts", {}).items()]
        partes += [f"apagar {k} {len(v)}" for k, v in lote.get("deletes", {}).items()]
        partes += [f"ajuste {k}" for k in lote.get("settings", {})]
        mudancas.append("vault→Coado: " + ", ".join(partes))

    if args.verbose or args.seco:
        for l in log + mudancas:
            print(l)
    if args.seco:
        print(json.dumps(lote, ensure_ascii=False)[:3000] if lote else "Coado: nada a enviar")
        return
    # Coado primeiro: se ele recusar, a vault não muda e a base não avança
    if lote:
        coado.sync(lote)
    pulados = set()
    for caminho in sujos:
        fm, corpo, mt = arquivos[caminho]
        if any(isinstance(e, dict) and e.get("startTime") and not e.get("endTime") for e in fm.get("timeEntries") or []):
            log.append(f"cronômetro rodando, fica para a próxima: {os.path.relpath(caminho, vault.raiz)}")
            pulados.add(caminho)
            continue
        if caminho in caminhos_tarefa:                       # tarefa do Davi: só os itens da ponte
            gravar_tarefa(caminho, fm, mt)
        else:
            gravar_nota(caminho, fm, corpo, mt)
    if estado_mudou:
        gravar_nota(estado_p, efm, ecorpo, emt)
    # o que ficou numa nota pulada não foi aplicado: a base guarda o valor antigo, e a próxima rodada refaz
    base_est_nova = dict(r_estudos)
    for sid, notas in toques.items():
        if notas & pulados:
            if sid in base_est:
                base_est_nova[sid] = base_est[sid]
            else:
                base_est_nova.pop(sid, None)
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(base_path + ".tmp", "w") as f:
        json.dump({"studies": base_est_nova, "reviews": r_rev, "planning": r_plan, "topics_done": r_top, "goals": r_meta,
                   "confirmados": {"studies": sorted(v_real), "reviews": sorted(v_rev_real)},
                   "anki_importados": sorted(importados),
                   "at": dt.datetime.now(TZ).isoformat()}, f, ensure_ascii=False)
    os.replace(base_path + ".tmp", base_path)
    registrar(nome, log + mudancas)
    if args.verbose and not mudancas:
        print("nada mudou")


def registrar(nome, linhas):
    if not linhas:
        return
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(os.path.join(LOG_DIR, f"coado_ponte-{nome}.log"), "a") as f:
        for l in linhas:
            f.write(f"{dt.datetime.now(TZ).isoformat(timespec='seconds')} {l}\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", required=True)
    ap.add_argument("--init", action="store_true", help="cria as notas-razão e a nota de estado que faltarem")
    ap.add_argument("--seco", action="store_true", help="mostra o que faria, sem gravar nada")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    nome = ler_config(args.config).get("NOME", "padrao")
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(os.path.join(STATE_DIR, f"coado_ponte-{nome}.lock"), "w") as trava:
        try:
            fcntl.flock(trava, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return                                            # rodada anterior ainda em curso
        try:
            rodada(args)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if args.verbose:
                print(f"Coado inalcançável: {e}")         # sem rede: a próxima rodada recupera
        except SystemExit as e:
            if e.code not in (None, 0):
                registrar(nome, [f"parou: {e.code}"])
            raise
        except Exception as e:
            registrar(nome, [f"erro: {e!r}"])
            raise


if __name__ == "__main__":
    main()
