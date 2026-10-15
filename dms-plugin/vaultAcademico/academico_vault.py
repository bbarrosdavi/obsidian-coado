#!/usr/bin/python3
"""Motor de leitura e escrita do sistema acadêmico da vault (Coado + Academic Dashboard) para o DMS.

Lê direto dos arquivos de System/Academico na vault (sem precisar do Obsidian aberto):
  - Semestre ativo e nota de estado (System/Academico/Semestres/<semestre> Estudo.md)
  - Disciplinas, tópicos do conteúdo programático e tabelas de avaliações
  - Estudos registrados em timeEntries das notas-razão (<COD> Estudo <semestre>.md) e tarefas com class:
  - Progresso do ciclo de estudos, constância, metas da semana, revisões, Anki e prazos de entregas

Também executa ações atômicas preservando o frontmatter:
  - status <vault>
  - registrar <vault> <json>
  - revisao <vault> <id> <status>
  - recomecar_ciclo <vault>
  - concluir_tarefa <vault> <rel_path>
  - alternar_topico <vault> <topic_id>
  - anki_revisar <baralho>
"""
import datetime as dt
import json
import math
import os
import re
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    import yaml
except ImportError:
    import glob
    for _p in sorted(glob.glob("/usr/lib/python3.*/site-packages"), reverse=True):
        if _p not in sys.path:
            sys.path.append(_p)
    import yaml

TZ = ZoneInfo("America/Sao_Paulo")
MIN_SEGUNDOS = 60
DIAS_CURTOS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"]
DIAS_DOM_SAB = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]
DIAS_LONGOS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
CATEGORIAS = {
    "teoria": "Teoria",
    "revisao": "Revisão",
    "questoes": "Questões",
    "execucao": "Execução",
}
FECHADOS = {"done", "cancelled", "concluido", "concluído", "archived"}
DATA_BR = re.compile(r"(\d{2})/(\d{2})/(\d{4})")
PESO_RE = re.compile(r"^\d+(?:[.,]\d+)?\s*%$")


# ───────────────────────────── YAML seguro e rápido ─────────────────────────────

class _Loader(getattr(yaml, "CSafeLoader", yaml.SafeLoader)):
    """Mantém datas e horas ISO como string."""


_Loader.yaml_implicit_resolvers = {
    k: [r for r in v if r[0] != "tag:yaml.org,2002:timestamp"]
    for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()
}


class _Dumper(yaml.SafeDumper):
    def increase_indent(self, flow=False, indentless=False):
        return super().increase_indent(flow, False)


def _str_rep(d, s):
    estilo = '"' if (":" in s or s.startswith(("[", "#", "{", "*", "&", "!"))) else None
    return d.represent_scalar("tag:yaml.org,2002:str", s, style=estilo)


_Dumper.add_representer(str, _str_rep)


def ler_nota(caminho: Path) -> tuple[dict, str]:
    try:
        texto = caminho.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}, ""
    if not texto.startswith("---"):
        return {}, texto
    m = re.match(r"^---\n(.*?)\n---\n?", texto, re.S)
    if not m:
        return {}, texto
    try:
        fm = yaml.load(m.group(1), Loader=_Loader)
    except yaml.YAMLError:
        fm = {}
    return (fm if isinstance(fm, dict) else {}), texto[m.end():]


def gravar_nota(caminho: Path, fm: dict, corpo: str) -> None:
    y = yaml.dump(
        fm,
        Dumper=_Dumper,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        width=1000,
    )
    texto = f"---\n{y}---\n{corpo}"
    fd, tmp = tempfile.mkstemp(dir=str(caminho.parent), prefix=".acad-", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(texto)
    os.replace(tmp, caminho)


# ───────────────────────────── Utilitários de data e formato ─────────────────────────────

def hoje_data() -> dt.date:
    return dt.datetime.now(TZ).date()


def parse_data(v) -> dt.date | None:
    if not v:
        return None
    s = str(v).strip()[:10]
    try:
        return dt.date.fromisoformat(s)
    except ValueError:
        return None


def parse_iso(s: str) -> dt.datetime | None:
    if not s:
        return None
    try:
        d = dt.datetime.fromisoformat(str(s).strip().replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=TZ)
        return d.astimezone(TZ)
    except ValueError:
        return None


def iso_utc(d: dt.datetime) -> str:
    u = d.astimezone(dt.timezone.utc)
    return u.strftime("%Y-%m-%dT%H:%M:%S.") + f"{u.microsecond // 1000:03d}Z"


def inicio_semana_dom(d: dt.date) -> dt.date:
    # No dc-coadoCore.jsx: startOfWeek usa getDay() (0 = Domingo)
    dias_desde_dom = (d.weekday() + 1) % 7
    return d - dt.timedelta(days=dias_desde_dom)


def fmt_duracao(segundos: float) -> str:
    total = int(round(segundos / 60))
    h, m = divmod(total, 60)
    if h == 0:
        return f"{m}min"
    return f"{h}h{m:02d}min"


def fmt_minutos(minutos: float) -> str:
    return fmt_duracao(minutos * 60)


def fmt_horas(horas: float) -> str:
    v = round(horas * 10) / 10
    s = f"{v:g}".replace(".", ",")
    return f"{s}h"


def fmt_dia_mes(d: dt.date) -> str:
    return f"{d.day:02d}/{d.month:02d}"


def pct(parte: float, total: float) -> int:
    return int(round((parte / total) * 100)) if total > 0 else 0


def alvo_wikilink(v) -> str | None:
    m = re.search(r"\[\[([^\]|#]+)", str(v or ""))
    return m.group(1).strip() if m else None


def lista_str(v) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v if x is not None]
    return [str(v)]


def status_normalizado(v) -> str:
    itens = lista_str(v)
    return itens[0].strip().lower() if itens else "open"


def limpar_md(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"\*\*|`", "", str(s or ""))).strip()


def quando_texto(dias: int, atrasado_prefixo: bool = False) -> str:
    if dias == 0:
        return "hoje"
    if dias == 1:
        return "amanhã"
    if dias == -1:
        return "atrasado 1d" if atrasado_prefixo else "há 1 dia"
    if dias < 0:
        return f"atrasado {-dias}d" if atrasado_prefixo else f"há {-dias} dias"
    return f"em {dias}d"


# ───────────────────────────── Leitura de avaliações e estudos ─────────────────────────────

def extrair_avaliacoes_tabela(corpo: str, disc: dict, rel_nota: str) -> list[dict]:
    out = []
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
        data_iso = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
        data_dt = parse_data(data_iso)
        if not data_dt:
            continue
        cels = [c.strip() for c in linha.strip().strip("|").split("|")]
        negrito = re.search(r"\*\*([^*]+)\*\*", linha)
        peso = next((c for c in cels if PESO_RE.match(c)), None)
        if not peso:
            mp = re.search(r"(\d+\s*%)", linha)
            peso = mp.group(1).replace(" ", "") if mp else ""
        c_data = next((c for c in cels if DATA_BR.search(c)), "")
        c_neg = next((c for c in cels if negrito and negrito.group(0) in c), None)
        if negrito:
            nome = limpar_md(negrito.group(1))
        else:
            nome = limpar_md(next((c for c in cels if c != c_data and not PESO_RE.match(c)), "Avaliação"))
        extra_data = limpar_md(DATA_BR.sub("", c_data))
        extra_data = re.sub(r"^\s*at[ée]\s*", "", extra_data, flags=re.I).lstrip(",; ")
        extra_nome = ""
        if c_neg and negrito:
            extra_nome = limpar_md(re.sub(r"\(\s*\d+\s*%\s*\)", "", c_neg.replace(negrito.group(0), ""))).lstrip(",:; ")
        outros = [
            limpar_md(c)
            for c in cels
            if c not in (c_data, c_neg, peso) and limpar_md(c) != nome
        ]
        detalhe = " · ".join(x for x in [extra_data, extra_nome, *outros] if x)
        ate = bool(re.match(r"^\s*at[ée]\s", c_data, flags=re.I))
        out.append({
            "cod": disc["cod"],
            "id": disc["id"],
            "tituloDisciplina": disc["titulo"],
            "cor": disc["cor"],
            "path": rel_nota,
            "data": data_iso,
            "nome": nome,
            "peso": peso or "",
            "detalhe": detalhe,
            "ate": ate,
        })
    return out


def estudo_da_entrada(e: dict, disc: dict, rel_path: str, idx: int) -> dict | None:
    if not isinstance(e, dict) or not e.get("startTime") or not e.get("endTime"):
        return None
    ini = parse_iso(e["startTime"])
    fim = parse_iso(e["endTime"])
    if not ini or not fim:
        return None
    dur = int(round((fim - ini).total_seconds()))
    if dur < MIN_SEGUNDOS:
        return None
    cat_padrao = "execucao" if disc["natureza"] == "execucao" else "teoria"
    cat = str(e.get("categoria") or cat_padrao)
    topico_id = str(e.get("topico") or "")
    topico_nome = disc["topicos_map"].get(topico_id, "")
    return {
        "id": str(e.get("coado") or f"{rel_path}#{idx}"),
        "subjectId": disc["id"],
        "cod": disc["cod"],
        "cor": disc["cor"],
        "topicId": topico_id,
        "topicoNome": topico_nome,
        "categoryId": cat,
        "categoria": CATEGORIAS.get(cat, cat.capitalize()),
        "date": ini.strftime("%Y-%m-%d"),
        "time": ini.strftime("%H:%M"),
        "duration": dur,
        "duracaoTexto": fmt_duracao(dur),
        "hits": int(e.get("acertos") or 0),
        "misses": int(e.get("erros") or 0),
        "countInPlanning": e.get("ciclo") is not False,
        "fonte": str(e.get("fonte") or "pomodoro"),
        "confirmado": e.get("confirmado") is not False,
        "path": rel_path,
        "index": idx,
    }


def progresso_ciclo(ciclo: list[dict], inicio_ciclo: str, estudos: list[dict], por_id: dict) -> list[dict]:
    itens = [
        {
            "id": str(c.get("id") or f"s{i}"),
            "pos": i + 1,
            "subjectId": str(c.get("codigo") or "").lower(),
            "cod": str(c.get("codigo") or "").upper(),
            "minutos": int(c.get("minutos") or 60),
            "studied": 0,
            "done": False,
        }
        for i, c in enumerate(ciclo)
    ]
    relevantes = [
        s for s in estudos
        if s["countInPlanning"] and s["date"] >= inicio_ciclo
    ]
    relevantes.sort(key=lambda s: (s["date"], s["time"]))
    for s in relevantes:
        restante = s["duration"]
        proprios = [it for it in itens if it["subjectId"] == s["subjectId"]]
        if not proprios:
            continue
        for it in proprios:
            if restante <= 0:
                break
            vaga = it["minutos"] * 60 - it["studied"]
            if vaga <= 0:
                continue
            usado = min(vaga, restante)
            it["studied"] += usado
            restante -= usado
        if restante > 0:
            proprios[-1]["studied"] += restante

    out = []
    for it in itens:
        alvo_seg = it["minutos"] * 60
        feito = it["studied"] >= alvo_seg
        d = por_id.get(it["subjectId"], {})
        rest_min = max(1, int(round(max(0, alvo_seg - it["studied"]) / 60)))
        out.append({
            "id": it["id"],
            "pos": it["pos"],
            "subjectId": it["subjectId"],
            "cod": it["cod"],
            "titulo": d.get("titulo", it["cod"]),
            "cor": d.get("cor", "#999999"),
            "minutos": it["minutos"],
            "estudadoSeg": it["studied"],
            "estudadoTexto": fmt_duracao(it["studied"]),
            "duracaoTexto": fmt_minutos(it["minutos"]),
            "restanteMin": rest_min,
            "pct": min(100, pct(it["studied"], alvo_seg)),
            "done": feito,
            "razaoPath": d.get("razaoPath", ""),
            "notaPath": d.get("path", ""),
        })
    return out


def calcular_constancia(estudos: list[dict], hoje: dt.date) -> tuple[dict, list[dict]]:
    por_dia: dict[str, int] = {}
    for s in estudos:
        por_dia[s["date"]] = por_dia.get(s["date"], 0) + s["duration"]

    dias_estudados = sorted(por_dia.keys())
    recorde = 0
    atual_run = 0
    anterior: dt.date | None = None
    for ds in dias_estudados:
        d = parse_data(ds)
        if not d:
            continue
        if anterior and (d - anterior).days == 1:
            atual_run += 1
        else:
            atual_run = 1
        recorde = max(recorde, atual_run)
        anterior = d

    hoje_iso = hoje.isoformat()
    ontem_iso = (hoje - dt.timedelta(days=1)).isoformat()
    cursor = hoje if hoje_iso in por_dia else (hoje - dt.timedelta(days=1) if ontem_iso in por_dia else None)
    seq = 0
    while cursor and cursor.isoformat() in por_dia:
        seq += 1
        cursor -= dt.timedelta(days=1)

    passados = [ds for ds in dias_estudados if ds <= hoje_iso]
    ultimo = parse_data(passados[-1]) if passados else None
    dias_sem = (hoje - ultimo).days if ultimo else -1

    # Faixa de 14 dias: 10 dias atrás até 3 dias à frente (mesmo recorte do dc-coadoPainel.jsx)
    inicio_14 = hoje - dt.timedelta(days=10)
    faixa = []
    for i in range(14):
        d = inicio_14 + dt.timedelta(days=i)
        iso = d.isoformat()
        seg = por_dia.get(iso, 0)
        faixa.append({
            "data": iso,
            "diaSemana": DIAS_CURTOS[d.weekday()],
            "diaMes": f"{d.day:02d}",
            "estudou": seg > 0,
            "hoje": d == hoje,
            "futuro": d > hoje,
            "segundos": seg,
            "texto": fmt_duracao(seg) if seg > 0 else "",
        })

    return {
        "sequencia": seq,
        "recorde": recorde,
        "diasSemEstudar": dias_sem,
        "estudouHoje": hoje_iso in por_dia,
        "diasEstudadosTotal": len(por_dia),
    }, faixa


# ───────────────────────────── Leitura completa do estado ─────────────────────────────

def carregar_estado(vault: Path) -> dict:
    acad = vault / "System" / "Academico"
    semestres_dir = acad / "Semestres"
    if not semestres_dir.is_dir():
        return {"ok": False, "erro": "Pasta System/Academico/Semestres não encontrada"}

    estado_file: Path | None = None
    est_fm: dict = {}
    for arq in sorted(semestres_dir.glob("* Estudo.md")):
        fm, _ = ler_nota(arq)
        if fm.get("coado_plano"):
            estado_file = arq
            est_fm = fm
            break

    if not estado_file:
        return {"ok": False, "erro": "Nota de estado do semestre (<semestre> Estudo.md) não encontrada"}

    semestre = alvo_wikilink(est_fm.get("semestre")) or estado_file.name.replace(" Estudo.md", "")
    sem_file = semestres_dir / f"{semestre}.md"
    sem_fm, _ = ler_nota(sem_file) if sem_file.exists() else ({}, "")
    inicio_sem = str(sem_fm.get("start") or "1970-01-01")[:10]

    hoje = hoje_data()
    hoje_iso = hoje.isoformat()
    cores = est_fm.get("cores") or {}
    topicos_concluidos = {str(x) for x in (est_fm.get("topicos_concluidos") or [])}

    # 1. Disciplinas
    discs = []
    disc_dir = acad / "Disciplinas"
    if disc_dir.is_dir():
        for pasta in sorted(disc_dir.iterdir()):
            if not pasta.is_dir():
                continue
            for arq in sorted(pasta.glob("*.md")):
                fm, corpo = ler_nota(arq)
                if fm.get("type") != "disciplina" or str(fm.get("semestre")) != semestre:
                    continue
                cod = str(fm.get("codigo") or arq.stem).strip()
                cid = cod.lower()
                topicos = []
                topicos_map = {}
                for t in fm.get("conteudo_programatico") or []:
                    if not isinstance(t, dict) or not t.get("id"):
                        continue
                    tid = f"{cid}_{t['id']}"
                    tnome = str(t.get("nome") or t["id"]).rstrip(".")
                    aula = int(t.get("aula") or 0)
                    topicos.append({
                        "id": tid,
                        "nome": tnome,
                        "aula": aula,
                        "concluido": tid in topicos_concluidos,
                    })
                    topicos_map[tid] = tnome

                rel_nota = str(arq.relative_to(vault))
                rel_razao = str((pasta / f"{cod} Estudo {semestre}.md").relative_to(vault))
                nota_val = fm.get("nota")
                nota_num = None
                if nota_val is not None and str(nota_val).strip() != "":
                    try:
                        nota_num = float(str(nota_val).replace(",", "."))
                    except ValueError:
                        nota_num = None

                d_obj = {
                    "id": cid,
                    "cod": cod,
                    "nome": arq.stem,
                    "titulo": str(fm.get("disciplina") or arq.stem),
                    "professor": str(fm.get("professor") or ""),
                    "sala": str(fm.get("sala") or ""),
                    "cor": str(cores.get(cod) or "#cba6f7"),
                    "natureza": str(fm.get("natureza") or "conteudo"),
                    "path": rel_nota,
                    "razaoPath": rel_razao,
                    "pasta": pasta,
                    "corpo": corpo,
                    "nota": nota_num,
                    "topicos": topicos,
                    "topicos_map": topicos_map,
                }
                discs.append(d_obj)

    discs.sort(key=lambda d: d["cod"])
    por_id = {d["id"]: d for d in discs}
    por_nome = {d["nome"]: d for d in discs}

    # 2. Estudos (timeEntries) + Tarefas/Entregas + Avaliações
    estudos = []
    avaliacoes = []
    trabalhos = []
    notas_lancadas = []

    for d in discs:
        avaliacoes.extend(extrair_avaliacoes_tabela(d["corpo"], d, d["path"]))
        pasta: Path = d["pasta"]
        caminho_razao = pasta / f"{d['cod']} Estudo {semestre}.md"

        for arq in sorted(pasta.glob("*.md")):
            if arq.name == f"{ d['nome'] }.md":
                continue
            fm, _ = ler_nota(arq)
            if not fm:
                continue
            rel = str(arq.relative_to(vault))
            eh_razao = (arq == caminho_razao)
            tags = [t.lstrip("#") for t in lista_str(fm.get("tags"))]
            cats = " ".join(lista_str(fm.get("categories"))).lower()
            alvo_cls = alvo_wikilink(fm.get("class"))
            eh_task_disc = ("tipo/task" in tags and alvo_cls == d["nome"])
            eh_trabalho = ("trabalhos curso" in cats) or (eh_task_disc and not eh_razao)

            # Estudos em timeEntries
            if (eh_razao or eh_task_disc) and isinstance(fm.get("timeEntries"), list):
                for i, entrada in enumerate(fm["timeEntries"]):
                    est = estudo_da_entrada(entrada, d, rel, i)
                    if est and est["date"] >= inicio_sem:
                        estudos.append(est)

            # Exames extras
            if str(fm.get("type") or "").lower() == "exame" and fm.get("due_date"):
                dt_ex = str(fm["due_date"])[:10]
                if parse_data(dt_ex) and not any(a["cod"] == d["cod"] and a["data"] == dt_ex for a in avaliacoes):
                    avaliacoes.append({
                        "cod": d["cod"],
                        "id": d["id"],
                        "tituloDisciplina": d["titulo"],
                        "cor": d["cor"],
                        "path": rel,
                        "data": dt_ex,
                        "nome": arq.stem,
                        "peso": "",
                        "detalhe": "",
                        "ate": False,
                    })

            # Entregas / Coursework
            if eh_trabalho and not eh_razao:
                st = status_normalizado(fm.get("status"))
                concluida = st in FECHADOS
                prazo_raw = fm.get("due_date") or fm.get("due")
                prazo_dt = parse_data(prazo_raw)
                nota_t = fm.get("nota")
                if nota_t is not None and str(nota_t).strip() != "":
                    try:
                        notas_lancadas.append(float(str(nota_t).replace(",", ".")))
                    except ValueError:
                        pass
                titulo_t = str(fm.get("title") or arq.stem)
                trabalhos.append({
                    "path": rel,
                    "title": titulo_t,
                    "cod": d["cod"],
                    "subjectId": d["id"],
                    "cor": d["cor"],
                    "type": str(fm.get("type") or "tarefa"),
                    "status": st,
                    "priority": str(fm.get("priority") or "normal"),
                    "concluida": concluida,
                    "due": prazo_dt.isoformat() if prazo_dt else "",
                    "dueDt": prazo_dt,
                })

    estudos.sort(key=lambda s: (s["date"], s["time"]), reverse=True)

    # 3. Processar Avaliações
    avaliacoes.sort(key=lambda a: (a["data"], a["cod"]))
    avaliacoes_out = []
    for a in avaliacoes:
        dt_a = parse_data(a["data"])
        if not dt_a:
            continue
        dias = (dt_a - hoje).days
        avaliacoes_out.append({
            **a,
            "dataCurta": fmt_dia_mes(dt_a),
            "diaSemana": DIAS_LONGOS[dt_a.weekday()].lower(),
            "dias": dias,
            "quando": quando_texto(dias, atrasado_prefixo=False),
            "passou": dias < 0,
        })
    futuras_aval = [a for a in avaliacoes_out if not a["passou"]]
    proxima_avaliacao = futuras_aval[0] if futuras_aval else None

    # 4. Processar Prazos (Entregas abertas)
    prazos_abertos = []
    atrasados_count = 0
    semana_count = 0
    for w in trabalhos:
        if w["concluida"]:
            continue
        dt_w = w["dueDt"]
        dias = (dt_w - hoje).days if dt_w else 999
        atrasado = dt_w is not None and dias < 0
        na_semana = dt_w is not None and 0 <= dias <= 7
        if atrasado:
            atrasados_count += 1
        elif na_semana:
            semana_count += 1
        if dt_w is not None or w["status"] == "in-progress":
            prazos_abertos.append({
                "path": w["path"],
                "title": w["title"],
                "cod": w["cod"],
                "subjectId": w["subjectId"],
                "cor": w["cor"],
                "type": w["type"],
                "status": w["status"],
                "priority": w["priority"],
                "due": w["due"],
                "dueCurto": fmt_dia_mes(dt_w) if dt_w else "",
                "dias": dias,
                "quando": quando_texto(dias, atrasado_prefixo=True) if dt_w else "em andamento",
                "atrasado": atrasado,
                "naSemana": na_semana,
            })

    prazos_abertos.sort(key=lambda x: (not x["atrasado"], x["dias"], x["title"].lower()))

    # 5. Revisões e Anki
    revisoes_raw = est_fm.get("revisoes") or []
    revisoes_pendentes = []
    revisoes_hoje_count = 0
    for r in revisoes_raw:
        if not isinstance(r, dict) or not r.get("id"):
            continue
        st_r = str(r.get("status") or "pendente")
        if st_r != "pendente":
            continue
        vence_iso = str(r.get("vence") or "")[:10]
        vence_dt = parse_data(vence_iso)
        if not vence_dt:
            continue
        dias_r = (vence_dt - hoje).days
        if dias_r <= 0:
            revisoes_hoje_count += 1
        cid = str(r.get("disciplina") or "").lower()
        d_r = por_id.get(cid, {})
        top_id = str(r.get("topico") or "")
        top_nome = d_r.get("topicos_map", {}).get(top_id, "")
        revisoes_pendentes.append({
            "id": str(r["id"]),
            "cod": str(r.get("disciplina") or "").upper(),
            "subjectId": cid,
            "cor": d_r.get("cor", "#999999"),
            "topicoId": top_id,
            "topicoNome": top_nome,
            "vence": vence_iso,
            "venceCurto": fmt_dia_mes(vence_dt),
            "intervalo": int(r.get("intervalo") or 1),
            "dias": dias_r,
            "atrasada": dias_r < 0,
            "hoje": dias_r <= 0,
        })
    revisoes_pendentes.sort(key=lambda r: (r["vence"], r["cod"]))

    anki_raw = est_fm.get("anki") or {}
    anki_list = []
    anki_hoje_total = 0
    anki_novos_total = 0
    for d in discs:
        ak = anki_raw.get(d["cod"])
        if isinstance(ak, dict):
            ph = int(ak.get("para_hoje") or 0)
            nv = int(ak.get("novos") or 0)
            cd = int(ak.get("cards") or 0)
            rh = int(ak.get("revisados_hoje") or 0)
            r30 = int(ak.get("revisoes_30d") or 0)
            a30 = int(ak.get("acertos_30d") or 0)
            anki_hoje_total += ph
            anki_novos_total += nv
            anki_list.append({
                "cod": d["cod"],
                "cor": d["cor"],
                "baralho": str(ak.get("baralho") or f"Faculdade::{d['cod']}"),
                "cards": cd,
                "novos": nv,
                "paraHoje": ph,
                "revisadosHoje": rh,
                "retencao30d": pct(a30, r30) if r30 > 0 else -1,
            })

    # 6. Planejamento e Ciclo (enriquecido com o compromisso urgente de cada disciplina)
    pl = est_fm.get("planejamento") or {}
    inicio_ciclo = str(pl.get("inicio_ciclo") or hoje_iso)[:10]
    sessoes_ciclo = progresso_ciclo(pl.get("ciclo") or [], inicio_ciclo, estudos, por_id)

    # Filas de compromissos reais por disciplina (tarefas urgentes -> Anki hoje -> próxima prova)
    filas_comp: dict[str, list[tuple[str, str]]] = {}
    for d in discs:
        cid = d["id"]
        cod = d["cod"]
        lista_c: list[tuple[str, str]] = []
        # Tarefas abertas da disciplina: prioriza as que vencem hoje, depois atrasadas, depois próximas com data, e por último sem data
        pr_d = [p for p in prazos_abertos if p["subjectId"] == cid]
        pr_d.sort(key=lambda p: (
            0 if p["dias"] == 0 else (1 if p["atrasado"] else (2 if p["dias"] < 900 else 4)),
            abs(p["dias"]),
        ))
        for p in pr_d:
            if p["dias"] >= 900 and cid == "elt75a":
                # Roteiro P1 sem data já passou (P1 foi 13/10)
                continue
            nome_curto = p["title"]
            if nome_curto.upper().startswith(cod.upper()):
                nome_curto = nome_curto[len(cod):].strip(" -_·")
            nome_curto = nome_curto.replace("_", " ")
            urg_dias = -1 if p["dias"] == 0 else (0 if p["atrasado"] else p["dias"])
            lista_c.append((f"{nome_curto} ({p['quando']})", p["path"], urg_dias))
        ak_d = anki_raw.get(cod) if isinstance(anki_raw.get(cod), dict) else {}
        if int(ak_d.get("para_hoje") or 0) > 0:
            ph_n = int(ak_d["para_hoje"])
            lista_c.append((f"Anki · {ph_n} {'card' if ph_n == 1 else 'cards'} hoje", d["razaoPath"], 3.5))
        av_d = [a for a in avaliacoes_out if a["id"] == cid and not a["passou"]]
        for a in av_d:
            lista_c.append((f"{a['nome']} ({a['quando']})", a["path"], float(a["dias"])))
        lista_c.sort(key=lambda x: x[2])
        filas_comp[cid] = [(x[0], x[1]) for x in lista_c]

    cont_sess_disc: dict[str, int] = {}
    for s in sessoes_ciclo:
        cid = s["subjectId"]
        idx_s = cont_sess_disc.get(cid, 0)
        if not s["done"]:
            cont_sess_disc[cid] = idx_s + 1
        fc = filas_comp.get(cid) or []
        if fc:
            escolhido = fc[min(idx_s, len(fc) - 1)]
            s["compromisso"] = escolhido[0]
            s["compromissoPath"] = escolhido[1]
        else:
            s["compromisso"] = ""
            s["compromissoPath"] = ""

    planejado_seg = sum(s["minutos"] * 60 for s in sessoes_ciclo)
    estudado_ciclo_seg = sum(min(s["estudadoSeg"], s["minutos"] * 60) for s in sessoes_ciclo)
    concluidas_ciclo = sum(1 for s in sessoes_ciclo if s["done"])
    proxima_sessao = next((s for s in sessoes_ciclo if not s["done"]), None)

    # 7. Agregações de tempo, semana e constância
    ini_sem_dom = inicio_semana_dom(hoje).isoformat()
    estudos_semana = [s for s in estudos if ini_sem_dom <= s["date"] <= hoje_iso]
    estudos_hoje = [s for s in estudos if s["date"] == hoje_iso]

    semana_seg = sum(s["duration"] for s in estudos_semana)
    hoje_seg = sum(s["duration"] for s in estudos_hoje)
    total_seg = sum(s["duration"] for s in estudos)

    acertos_total = sum(s["hits"] for s in estudos)
    erros_total = sum(s["misses"] for s in estudos)
    questoes_total = acertos_total + erros_total
    semana_questoes = sum(s["hits"] + s["misses"] for s in estudos_semana)

    meta_raw = est_fm.get("meta_semanal") or {}
    meta_min = int(meta_raw.get("minutos") or pl.get("minutos_semana") or 960)
    meta_questoes = int(meta_raw.get("questoes") or 0)

    constancia, constancia_14 = calcular_constancia(estudos, hoje)

    # 8. Resumo por disciplina
    disciplinas_out = []
    for d in discs:
        est_d = [s for s in estudos if s["subjectId"] == d["id"]]
        est_d_sem = [s for s in estudos_semana if s["subjectId"] == d["id"]]
        seg_tot = sum(s["duration"] for s in est_d)
        seg_sem = sum(s["duration"] for s in est_d_sem)
        h_d = sum(s["hits"] for s in est_d)
        m_d = sum(s["misses"] for s in est_d)
        q_d = h_d + m_d

        trab_d = [w for w in trabalhos if w["subjectId"] == d["id"]]
        feitas_d = sum(1 for w in trab_d if w["concluida"])
        atras_d = sum(
            1 for w in trab_d
            if not w["concluida"] and w["dueDt"] is not None and w["dueDt"] < hoje
        )

        ak_d = anki_raw.get(d["cod"]) if isinstance(anki_raw.get(d["cod"]), dict) else {}
        top_feitos = sum(1 for t in d["topicos"] if t["concluido"])

        disciplinas_out.append({
            "id": d["id"],
            "cod": d["cod"],
            "nome": d["nome"],
            "titulo": d["titulo"],
            "professor": d["professor"],
            "sala": d["sala"],
            "cor": d["cor"],
            "natureza": d["natureza"],
            "path": d["path"],
            "razaoPath": d["razaoPath"],
            "tempoSemanaSeg": seg_sem,
            "tempoSemanaTexto": fmt_duracao(seg_sem),
            "tempoTotalSeg": seg_tot,
            "tempoTotalTexto": fmt_duracao(seg_tot),
            "acertos": h_d,
            "erros": m_d,
            "questoes": q_d,
            "desempenhoPct": pct(h_d, q_d),
            "entregasFeitas": feitas_d,
            "entregasTotal": len(trab_d),
            "entregasPct": pct(feitas_d, len(trab_d)),
            "atrasadas": atras_d,
            "ankiParaHoje": int(ak_d.get("para_hoje") or 0),
            "ankiCards": int(ak_d.get("cards") or 0),
            "ankiBaralho": str(ak_d.get("baralho") or ""),
            "topicosFeitos": top_feitos,
            "topicosTotal": len(d["topicos"]),
            "topicos": d["topicos"],
        })

    media_geral = round(sum(notas_lancadas) / len(notas_lancadas), 1) if notas_lancadas else None

    return {
        "ok": True,
        "semestre": semestre,
        "estadoPath": str(estado_file.relative_to(vault)),
        "painelPath": "System/Dashboards/Painel Academico.md",
        "estudoNotaPath": f"System/Academico/Semestres/{semestre} Estudo.md",
        "intervalosRevisao": [int(x) for x in (est_fm.get("intervalos_revisao") or [1, 7, 30])],
        "resumo": {
            "disciplinasAtivas": len(discs),
            "prazosSemana": semana_count,
            "atrasados": atrasados_count,
            "mediaGeral": media_geral,
            "semanaSegundos": semana_seg,
            "semanaTexto": fmt_horas(semana_seg / 3600),
            "semanaDuracao": fmt_duracao(semana_seg),
            "hojeSegundos": hoje_seg,
            "hojeTexto": fmt_duracao(hoje_seg),
            "totalSegundos": total_seg,
            "totalTexto": fmt_duracao(total_seg),
            "metaMinutos": meta_min,
            "metaTexto": fmt_horas(meta_min / 60),
            "metaPct": min(100, pct(semana_seg, meta_min * 60)),
            "metaQuestoes": meta_questoes,
            "semanaQuestoes": semana_questoes,
            "acertosTotal": acertos_total,
            "errosTotal": erros_total,
            "questoesTotal": questoes_total,
            "desempenhoPct": pct(acertos_total, questoes_total),
            "revisoesHoje": revisoes_hoje_count,
            "ankiHoje": anki_hoje_total,
            "ankiNovos": anki_novos_total,
            **constancia,
        },
        "constancia14": constancia_14,
        "proximaSessao": proxima_sessao,
        "ciclo": {
            "tipo": str(pl.get("tipo") or "ciclo"),
            "ciclosCompletos": int(pl.get("ciclos_completos") or 0),
            "inicioCiclo": inicio_ciclo,
            "concluidas": concluidas_ciclo,
            "totalSessoes": len(sessoes_ciclo),
            "estudadoSeg": estudado_ciclo_seg,
            "planejadoSeg": planejado_seg,
            "estudadoTexto": fmt_duracao(estudado_ciclo_seg),
            "planejadoTexto": fmt_duracao(planejado_seg),
            "pct": min(100, pct(estudado_ciclo_seg, planejado_seg)),
            "minutosSemana": int(pl.get("minutos_semana") or 960),
            "sessaoMin": int(pl.get("sessao_min") or 30),
            "sessaoMax": int(pl.get("sessao_max") or 90),
            "disciplinasNoCiclo": [str(x.get("codigo") or "").upper() for x in (pl.get("disciplinas") or []) if isinstance(x, dict) and float(x.get("importancia") or 0) > 0],
            "sessoes": sessoes_ciclo,
        },
        "proximaAvaliacao": proxima_avaliacao,
        "avaliacoes": avaliacoes_out[:12],
        "prazos": prazos_abertos[:15],
        "revisoes": revisoes_pendentes[:15],
        "anki": anki_list,
        "disciplinas": disciplinas_out,
        "historico": estudos[:15],
    }


# ───────────────────────────── Ações de escrita na vault ─────────────────────────────

def acao_registrar(vault: Path, payload: dict) -> dict:
    estado = carregar_estado(vault)
    if not estado.get("ok"):
        return estado

    subj_id = str(payload.get("subjectId") or "").lower()
    disc = next((d for d in estado["disciplinas"] if d["id"] == subj_id or d["cod"].lower() == subj_id), None)
    if not disc:
        return {"ok": False, "erro": f"Disciplina não encontrada: {subj_id}"}

    minutos = max(1, int(payload.get("minutos") or 25))
    cat = str(payload.get("categoryId") or ("execucao" if disc["natureza"] == "execucao" else "teoria"))
    topico_id = str(payload.get("topicId") or "")
    acertos = max(0, int(payload.get("hits") or 0))
    erros = max(0, int(payload.get("misses") or 0))
    conta_ciclo = payload.get("countInPlanning") is not False
    concluir_topico = bool(payload.get("finishTopic"))
    agendar_revisoes = payload.get("agendarRevisoes") is not False
    review_id = str(payload.get("reviewId") or "")

    agora = dt.datetime.now(TZ)
    ini = agora - dt.timedelta(minutes=minutos)
    sid = "v" + secrets.token_hex(8)[:15]

    topico_obj = next((t for t in disc["topicos"] if t["id"] == topico_id), None)
    partes_desc = [CATEGORIAS.get(cat, cat.capitalize())]
    if topico_obj:
        partes_desc.append(topico_obj["nome"])

    entrada: dict = {
        "startTime": iso_utc(ini),
        "description": " · ".join(partes_desc),
        "endTime": iso_utc(agora),
        "coado": sid,
        "categoria": cat,
    }
    if topico_id:
        entrada["topico"] = topico_id
    if acertos or erros:
        entrada["acertos"] = acertos
        entrada["erros"] = erros
    if not conta_ciclo:
        entrada["ciclo"] = False

    caminho_razao = vault / disc["razaoPath"]
    fm_r, corpo_r = ler_nota(caminho_razao)
    entries = list(fm_r.get("timeEntries") or [])
    entries.append(entrada)
    fm_r["timeEntries"] = entries
    gravar_nota(caminho_razao, fm_r, corpo_r)

    # Atualizar nota de estado (revisões, tópico concluído, ou revisão concluída)
    caminho_est = vault / estado["estadoPath"]
    fm_e, corpo_e = ler_nota(caminho_est)
    mudou_est = False
    hoje = hoje_data()

    if agendar_revisoes and not review_id:
        intervalos = estado.get("intervalosRevisao") or [1, 7, 30]
        revs = list(fm_e.get("revisoes") or [])
        for n in intervalos:
            vence = (hoje + dt.timedelta(days=int(n))).isoformat()
            revs.append({
                "id": "v" + secrets.token_hex(8)[:15],
                "estudo": sid,
                "disciplina": disc["cod"],
                "topico": topico_id or None,
                "vence": vence,
                "intervalo": int(n),
                "status": "pendente",
                "feita_em": None,
            })
        fm_e["revisoes"] = revs
        mudou_est = True

    if concluir_topico and topico_id:
        tc = set(str(x) for x in (fm_e.get("topicos_concluidos") or []))
        tc.add(topico_id)
        fm_e["topicos_concluidos"] = sorted(tc)
        mudou_est = True

    if review_id:
        for r in fm_e.get("revisoes") or []:
            if isinstance(r, dict) and str(r.get("id")) == review_id:
                r["status"] = "feita"
                r["feita_em"] = iso_utc(agora)
                mudou_est = True

    if mudou_est:
        gravar_nota(caminho_est, fm_e, corpo_e)

    return carregar_estado(vault)


def acao_revisao(vault: Path, review_id: str, novo_status: str) -> dict:
    estado = carregar_estado(vault)
    if not estado.get("ok"):
        return estado
    caminho_est = vault / estado["estadoPath"]
    fm_e, corpo_e = ler_nota(caminho_est)
    agora_iso = iso_utc(dt.datetime.now(TZ))
    for r in fm_e.get("revisoes") or []:
        if isinstance(r, dict) and str(r.get("id")) == review_id:
            r["status"] = novo_status
            r["feita_em"] = None if novo_status == "pendente" else agora_iso
    gravar_nota(caminho_est, fm_e, corpo_e)
    return carregar_estado(vault)


def acao_recomecar_ciclo(vault: Path) -> dict:
    estado = carregar_estado(vault)
    if not estado.get("ok"):
        return estado
    caminho_est = vault / estado["estadoPath"]
    fm_e, corpo_e = ler_nota(caminho_est)
    pl = dict(fm_e.get("planejamento") or {})
    pl["ciclos_completos"] = int(pl.get("ciclos_completos") or 0) + 1
    pl["inicio_ciclo"] = hoje_data().isoformat()
    fm_e["planejamento"] = pl
    gravar_nota(caminho_est, fm_e, corpo_e)
    return carregar_estado(vault)


def acao_pular_sessao(vault: Path, session_id: str = "") -> dict:
    """Move a sessão atual (ou session_id) para o fim da fila do ciclo."""
    estado = carregar_estado(vault)
    if not estado.get("ok"):
        return estado
    alvo_id = session_id or (estado.get("proximaSessao") or {}).get("id") or ""
    if not alvo_id:
        return estado
    caminho_est = vault / estado["estadoPath"]
    fm_e, corpo_e = ler_nota(caminho_est)
    pl = dict(fm_e.get("planejamento") or {})
    ciclo = list(pl.get("ciclo") or [])
    escolhida = next((c for c in ciclo if str(c.get("id")) == alvo_id), None)
    if escolhida:
        resto = [c for c in ciclo if str(c.get("id")) != alvo_id]
        pl["ciclo"] = resto + [escolhida]
        fm_e["planejamento"] = pl
        gravar_nota(caminho_est, fm_e, corpo_e)
    return carregar_estado(vault)


def acao_focar_sessao(vault: Path, session_id: str) -> dict:
    """Traz a sessão escolhida para a primeira posição pendente do ciclo."""
    estado = carregar_estado(vault)
    if not estado.get("ok") or not session_id:
        return estado
    feitas_ids = {s["id"] for s in (estado.get("ciclo", {}).get("sessoes") or []) if s.get("done")}
    caminho_est = vault / estado["estadoPath"]
    fm_e, corpo_e = ler_nota(caminho_est)
    pl = dict(fm_e.get("planejamento") or {})
    ciclo = list(pl.get("ciclo") or [])
    escolhida = next((c for c in ciclo if str(c.get("id")) == session_id), None)
    if escolhida:
        sem_ela = [c for c in ciclo if str(c.get("id")) != session_id]
        idx_insercao = 0
        while idx_insercao < len(sem_ela) and str(sem_ela[idx_insercao].get("id")) in feitas_ids:
            idx_insercao += 1
        sem_ela.insert(idx_insercao, escolhida)
        pl["ciclo"] = sem_ela
        fm_e["planejamento"] = pl
        gravar_nota(caminho_est, fm_e, corpo_e)
    return carregar_estado(vault)


def _js_round(x: float) -> int:
    return math.floor(x + 0.5)


def acao_replanejar_ciclo(vault: Path, payload: dict) -> dict:
    """Regera o ciclo de estudos com as disciplinas ativas e horas escolhidas (algoritmo do Coado)."""
    estado = carregar_estado(vault)
    if not estado.get("ok"):
        return estado
    caminho_est = vault / estado["estadoPath"]
    fm_e, corpo_e = ler_nota(caminho_est)
    pl = dict(fm_e.get("planejamento") or {})

    cods_ativos = [str(c).upper() for c in (payload.get("disciplinasAtivas") or [])]
    min_semana = int(payload.get("minutosSemana") or pl.get("minutos_semana") or 960)
    sessao_min = int(payload.get("sessaoMin") or pl.get("sessao_min") or 30)
    sessao_max = int(payload.get("sessaoMax") or pl.get("sessao_max") or 90)

    discs_atuais = {str(d.get("codigo")).upper(): d for d in (pl.get("disciplinas") or []) if isinstance(d, dict)}
    subs = []
    for d in estado.get("disciplinas") or []:
        cod = d["cod"].upper()
        if cods_ativos and cod not in cods_ativos:
            continue
        ant = discs_atuais.get(cod, {})
        imp = float(ant.get("importancia") or 4)
        con = float(ant.get("conhecimento") or 2.5)
        subs.append({"codigo": cod, "importancia": imp, "conhecimento": con})

    if not subs:
        return estado

    pesos = [s["importancia"] * (6 - s["conhecimento"]) for s in subs]
    soma = sum(pesos)
    total = max(min_semana, sessao_min * len(subs))
    para = lambda v, passo: max(passo, _js_round(v / passo) * passo)
    filas = []
    for s, w in zip(subs, pesos):
        minutos = max(sessao_min, para(w / soma * total, 15))
        n = max(1, math.ceil(minutos / sessao_max))
        sessao = min(sessao_max, max(sessao_min, para(minutos / n, 15)))
        filas.append({"cod": s["codigo"], "w": w, "sessoes": [int(sessao)] * n})

    novo_ciclo = []
    ultimo = None
    while any(f["sessoes"] for f in filas):
        cand = sorted([f for f in filas if f["sessoes"]], key=lambda f: (-len(f["sessoes"]), -f["w"]))
        pick = next((f for f in cand if f["cod"] != ultimo), cand[0])
        novo_ciclo.append({
            "id": secrets.token_hex(8),
            "codigo": pick["cod"],
            "minutos": pick["sessoes"].pop(0),
        })
        ultimo = pick["cod"]

    pl["minutos_semana"] = min_semana
    pl["sessao_min"] = sessao_min
    pl["sessao_max"] = sessao_max
    pl["disciplinas"] = subs
    pl["ciclo"] = novo_ciclo
    fm_e["planejamento"] = pl
    gravar_nota(caminho_est, fm_e, corpo_e)
    return carregar_estado(vault)


def acao_alinhar_urgencia(vault: Path) -> dict:
    """Reordena e recalibra o ciclo de estudos pela urgência real de cada compromisso acadêmico."""
    estado = carregar_estado(vault)
    if not estado.get("ok"):
        return estado

    prazos = estado.get("prazos") or []
    avaliacoes = [a for a in (estado.get("avaliacoes") or []) if not a.get("passou")]
    anki_map = {a["cod"]: a for a in (estado.get("anki") or [])}
    discs = estado.get("disciplinas") or []

    subs = []
    # Cada item da fila de uma disciplina: (urgencia_dias, minutos)
    filas_urg: dict[str, list[tuple[float, int]]] = {}

    for d in discs:
        cod = d["cod"].upper()
        pr_d = [
            p for p in prazos
            if p["cod"].upper() == cod and not (cod == "ELT75A" and p["dias"] >= 900)
        ]
        av_d = [a for a in avaliacoes if a["cod"].upper() == cod]
        ak_d = anki_map.get(cod, {})
        horas_sem = d.get("tempoSemanaSeg", 0) / 3600.0
        anki_hoje = int(ak_d.get("paraHoje") or 0)

        # Monta a fila de compromissos reais desta disciplina ordenada pela urgência (menor = mais urgente)
        comp_urg: list[float] = []
        for p in pr_d:
            if p["dias"] == 0:
                comp_urg.append(-2.0)   # vence hoje
            elif p["atrasado"]:
                comp_urg.append(-0.5)   # atrasado
            else:
                comp_urg.append(float(p["dias"]))
        if anki_hoje > 0:
            comp_urg.append(3.5)
        for a in av_d:
            comp_urg.append(float(a["dias"]))
        comp_urg.sort()

        tem_hoje = any(u <= -1.0 for u in comp_urg)
        atrasadas = sum(1 for p in pr_d if p["atrasado"])
        ate_14d = sum(1 for p in pr_d if 0 <= p["dias"] <= 14)
        prox_av_dias = min((a["dias"] for a in av_d), default=90)

        if tem_hoje or atrasadas > 0 or ate_14d >= 3:
            imp, con = 5.0, 1.5
            sessoes_d = [60, 60, 60]
        elif ate_14d >= 2 or any(0 <= p["dias"] <= 3 for p in pr_d):
            imp, con = 4.5, 2.0
            sessoes_d = [60, 60, 60]
        elif prox_av_dias <= 30:
            imp, con = 4.0, 2.0
            sessoes_d = [60, 60, 60]
        elif horas_sem >= 6.0:
            imp, con = 3.0, 4.0
            sessoes_d = [45, 45]
        else:
            imp, con = 2.0, 3.5
            sessoes_d = [60]

        subs.append({"codigo": cod, "importancia": imp, "conhecimento": con})
        fila_d = []
        for i, dur in enumerate(sessoes_d):
            u = comp_urg[i] if i < len(comp_urg) else (comp_urg[-1] + 15 * i if comp_urg else 60.0 + 10 * i)
            fila_d.append((u, dur))
        filas_urg[cod] = fila_d

    ordem_cods = sorted(filas_urg.keys())
    novo_ciclo = []
    ultimo = None
    while any(filas_urg[c] for c in ordem_cods):
        disponiveis = [c for c in ordem_cods if filas_urg[c]]
        # Escolhe a disciplina cujo próximo compromisso na fila é o mais urgente, sem repetir a mesma seguida
        cand = sorted(disponiveis, key=lambda c: (filas_urg[c][0][0], -len(filas_urg[c]), c))
        pick = next((c for c in cand if c != ultimo), cand[0])
        _, dur = filas_urg[pick].pop(0)
        novo_ciclo.append({
            "id": secrets.token_hex(8),
            "codigo": pick,
            "minutos": dur,
        })
        ultimo = pick

    caminho_est = vault / estado["estadoPath"]
    fm_e, corpo_e = ler_nota(caminho_est)
    pl = dict(fm_e.get("planejamento") or {})
    pl["disciplinas"] = subs
    pl["ciclo"] = novo_ciclo
    pl["minutos_semana"] = sum(c["minutos"] for c in novo_ciclo)
    fm_e["planejamento"] = pl
    gravar_nota(caminho_est, fm_e, corpo_e)
    return carregar_estado(vault)


def acao_alternar_topico(vault: Path, topic_id: str) -> dict:
    estado = carregar_estado(vault)
    if not estado.get("ok"):
        return estado
    caminho_est = vault / estado["estadoPath"]
    fm_e, corpo_e = ler_nota(caminho_est)
    tc = set(str(x) for x in (fm_e.get("topicos_concluidos") or []))
    if topic_id in tc:
        tc.remove(topic_id)
    else:
        tc.add(topic_id)
    fm_e["topicos_concluidos"] = sorted(tc)
    gravar_nota(caminho_est, fm_e, corpo_e)
    return carregar_estado(vault)


def acao_confirmar_estudo(vault: Path, rel_path: str, study_id: str, aceitar: bool) -> dict:
    arq = (vault / rel_path).resolve()
    if not str(arq).startswith(str(vault.resolve())) or not arq.is_file():
        return {"ok": False, "erro": f"Arquivo inválido: {rel_path}"}
    fm, corpo = ler_nota(arq)
    entries = list(fm.get("timeEntries") or [])
    novas = []
    for i, e in enumerate(entries):
        if not isinstance(e, dict):
            novas.append(e)
            continue
        eid = str(e.get("coado") or f"{rel_path}#{i}")
        if eid == study_id:
            if not aceitar:
                continue
            e = dict(e)
            e.pop("confirmado", None)
            if str(e.get("description") or "").startswith("Inferido do Ink"):
                e["description"] = "Estudo manuscrito (Ink)"
        novas.append(e)
    fm["timeEntries"] = novas
    gravar_nota(arq, fm, corpo)
    return carregar_estado(vault)


def acao_concluir_tarefa(vault: Path, rel_path: str) -> dict:
    arq = (vault / rel_path).resolve()
    if not str(arq).startswith(str(vault.resolve())) or not arq.is_file():
        return {"ok": False, "erro": f"Arquivo inválido: {rel_path}"}

    hoje_iso = hoje_data().isoformat()
    texto = arq.read_text(encoding="utf-8", errors="replace")
    m = re.match(r"^---\n(.*?)\n---\n?", texto, re.S)
    if m:
        linhas = m.group(1).split("\n")
        achou_status = False
        achou_comp = False
        novas = []
        i = 0
        while i < len(linhas):
            l = linhas[i]
            if re.match(r"^status\s*:", l):
                novas.append("status: done")
                achou_status = True
                i += 1
                while i < len(linhas) and re.match(r"^\s+-\s+", linhas[i]):
                    i += 1
                continue
            if re.match(r"^completedDate\s*:", l):
                novas.append(f"completedDate: '{hoje_iso}'")
                achou_comp = True
            else:
                novas.append(l)
            i += 1
        if not achou_status:
            novas.append("status: done")
        if not achou_comp:
            novas.append(f"completedDate: '{hoje_iso}'")
        novo_texto = "---\n" + "\n".join(novas) + "\n---\n" + texto[m.end():]
        fd, tmp = tempfile.mkstemp(dir=str(arq.parent), prefix=".task-", suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(novo_texto)
        os.replace(tmp, arq)

    return carregar_estado(vault)


def anki_connect(action: str, params: dict | None = None):
    corpo = json.dumps({"action": action, "version": 6, "params": params or {}}).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:8765",
        data=corpo,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=2.5) as r:
        res = json.loads(r.read().decode("utf-8"))
        if res.get("error"):
            raise RuntimeError(str(res["error"]))
        return res.get("result")


def acao_anki_revisar(baralho: str) -> dict:
    aberto = False
    try:
        anki_connect("version")
        aberto = True
    except Exception:
        env = os.environ.copy()
        env["PYTHONNOUSERSITE"] = "1"
        try:
            subprocess.Popen(
                ["niri", "msg", "action", "spawn", "--", "env", "PYTHONNOUSERSITE=1", "anki"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except Exception:
            subprocess.Popen(
                ["anki"],
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        for _ in range(40):
            time.sleep(0.5)
            try:
                anki_connect("version")
                aberto = True
                break
            except Exception:
                pass

    if not aberto:
        return {"ok": False, "erro": "AnkiConnect não respondeu em 20s"}

    if baralho:
        try:
            anki_connect("guiDeckReview", {"name": baralho})
        except Exception as e:
            return {"ok": False, "erro": str(e)}
    return {"ok": True}


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "erro": "Uso: academico_vault.py <acao> <vault> [...]"}))
        return

    acao = sys.argv[1]
    if acao == "anki_revisar":
        baralho = sys.argv[2] if len(sys.argv) > 2 else ""
        json.dump(acao_anki_revisar(baralho), sys.stdout, ensure_ascii=False)
        return

    vault = Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 else Path.home() / "Documentos/Obsidian_Vaults/megabrain"

    if acao == "status":
        json.dump(carregar_estado(vault), sys.stdout, ensure_ascii=False)
    elif acao == "registrar":
        payload = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
        json.dump(acao_registrar(vault, payload), sys.stdout, ensure_ascii=False)
    elif acao == "revisao":
        json.dump(acao_revisao(vault, sys.argv[3], sys.argv[4]), sys.stdout, ensure_ascii=False)
    elif acao == "recomecar_ciclo":
        json.dump(acao_recomecar_ciclo(vault), sys.stdout, ensure_ascii=False)
    elif acao == "pular_sessao":
        sid = sys.argv[3] if len(sys.argv) > 3 else ""
        json.dump(acao_pular_sessao(vault, sid), sys.stdout, ensure_ascii=False)
    elif acao == "focar_sessao":
        sid = sys.argv[3] if len(sys.argv) > 3 else ""
        json.dump(acao_focar_sessao(vault, sid), sys.stdout, ensure_ascii=False)
    elif acao == "replanejar_ciclo":
        payload = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
        json.dump(acao_replanejar_ciclo(vault, payload), sys.stdout, ensure_ascii=False)
    elif acao == "alinhar_urgencia":
        json.dump(acao_alinhar_urgencia(vault), sys.stdout, ensure_ascii=False)
    elif acao == "concluir_tarefa":
        json.dump(acao_concluir_tarefa(vault, sys.argv[3]), sys.stdout, ensure_ascii=False)
    elif acao == "alternar_topico":
        json.dump(acao_alternar_topico(vault, sys.argv[3]), sys.stdout, ensure_ascii=False)
    elif acao == "confirmar_estudo":
        aceitar = (sys.argv[5].lower() != "false") if len(sys.argv) > 5 else True
        json.dump(acao_confirmar_estudo(vault, sys.argv[3], sys.argv[4], aceitar), sys.stdout, ensure_ascii=False)
    else:
        json.dump({"ok": False, "erro": f"Ação desconhecida: {acao}"}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
