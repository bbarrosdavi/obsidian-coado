import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Common
import qs.Services
import qs.Widgets
import qs.Modules.Plugins

PluginComponent {
    id: root

    // Estado do sistema acadêmico lido de System/Academico na vault
    property bool carregado: false
    property bool carregando: false
    property string erro: ""
    property string semestre: "2026-02"
    property string estadoPath: "System/Academico/Semestres/2026-02 Estudo.md"
    property string painelPath: "System/Dashboards/Painel Academico.md"
    property string estudoNotaPath: "System/Academico/Semestres/2026-02 Estudo.md"

    property var resumo: ({
        disciplinasAtivas: 6,
        prazosSemana: 0,
        atrasados: 0,
        semanaSegundos: 0,
        semanaTexto: "0h",
        semanaDuracao: "0min",
        hojeSegundos: 0,
        hojeTexto: "0min",
        totalSegundos: 0,
        totalTexto: "0min",
        metaMinutos: 960,
        metaTexto: "16h",
        metaPct: 0,
        revisoesHoje: 0,
        ankiHoje: 0,
        ankiNovos: 0,
        sequencia: 0,
        recorde: 0,
        diasSemEstudar: 0,
        estudouHoje: false,
        acertosTotal: 0,
        errosTotal: 0,
        questoesTotal: 0,
        desempenhoPct: 0
    })
    property var constancia14: []
    property var proximaSessao: null
    property var ciclo: ({
        tipo: "ciclo",
        ciclosCompletos: 0,
        inicioCiclo: "",
        concluidas: 0,
        totalSessoes: 0,
        estudadoTexto: "0min",
        planejadoTexto: "0min",
        pct: 0,
        sessoes: []
    })
    property var proximaAvaliacao: null
    property var avaliacoes: []
    property var prazos: []
    property var revisoes: []
    property var anki: []
    property var disciplinas: []
    property var historico: []

    property string abaAtual: PluginService.loadPluginData("vaultAcademico", "abaAtual", "ciclo")
    readonly property bool windowVisible: academicoWin.visible
    readonly property string fonte: "Noto Sans"

    // Integração em memória com o plugin tasknotesPomodoro do DMS
    readonly property var pomodoro: PluginService.pluginDaemonInstances["tasknotesPomodoro"] ?? null
    readonly property bool pomodoroRodando: !!(pomodoro?.isRunning)
    readonly property bool pomodoroSessao: !!(pomodoro?.hasSession || pomodoro?.isRunning)
    readonly property string pomodoroTarefaPath: pomodoro?.taskPath ?? ""
    readonly property string pomodoroTarefaTitulo: pomodoro?.taskTitle ?? ""
    readonly property string pomodoroTempo: pomodoro?.timeRemainingFormatted ?? "25:00"
    readonly property real pomodoroProgresso: pomodoro?.progress ?? 0

    onPomodoroRodandoChanged: {
        if (!pomodoroRodando)
            atualizarDepois.restart();
    }

    Timer {
        id: atualizarDepois
        interval: 1200
        onTriggered: root.atualizar()
    }

    // Descoberta da vault (configuração do plugin ou ~/.config/obsidian/obsidian.json)
    property string nomeVault: "megabrain"
    property string caminhoVault: Quickshell.env("HOME") + "/Documentos/Obsidian_Vaults/megabrain"
    readonly property string scriptPython: decodeURIComponent(Qt.resolvedUrl("academico_vault.py").toString().replace("file://", ""))

    FileView {
        path: Quickshell.env("HOME") + "/.config/obsidian/obsidian.json"
        printErrors: false
        onLoaded: {
            try {
                const custom = root.pluginData?.vaultPath;
                if (custom && custom.trim().length > 0) {
                    const c = custom.trim().replace(/^~/, Quickshell.env("HOME")).replace(/\/+$/, "");
                    root.caminhoVault = c;
                    root.nomeVault = c.split("/").pop();
                    root.atualizar();
                    return;
                }
                const vaults = Object.values(JSON.parse(text()).vaults || {});
                const aberta = vaults.find(v => v.open) || vaults[0];
                if (aberta?.path) {
                    root.caminhoVault = aberta.path.replace(/\/+$/, "");
                    root.nomeVault = root.caminhoVault.split("/").pop();
                }
            } catch (e) {
                console.warn("[VaultAcademico] obsidian.json:", e);
            }
            root.atualizar();
        }
        onLoadFailed: root.atualizar()
    }

    // Observa mudanças na nota de estado do semestre para atualizar na hora
    FileView {
        id: vigiaEstado
        path: root.caminhoVault + "/" + root.estadoPath
        watchChanges: true
        printErrors: false
        onFileChanged: {
            reload();
            debounceAtualizar.restart();
        }
    }

    Timer {
        id: debounceAtualizar
        interval: 400
        onTriggered: root.atualizar()
    }

    Timer {
        id: refreshTimer
        interval: academicoWin.visible ? 15000 : 45000
        repeat: true
        running: true
        onTriggered: root.atualizar()
    }

    function aplicarDados(txt) {
        try {
            const d = JSON.parse(txt);
            if (!d || !d.ok) {
                root.erro = d?.erro || "Falha ao ler o sistema acadêmico";
                return;
            }
            root.erro = "";
            root.semestre = d.semestre || "2026-02";
            root.estadoPath = d.estadoPath || root.estadoPath;
            root.painelPath = d.painelPath || root.painelPath;
            root.estudoNotaPath = d.estudoNotaPath || root.estudoNotaPath;
            root.resumo = d.resumo || root.resumo;
            root.constancia14 = d.constancia14 || [];
            root.proximaSessao = d.proximaSessao || null;
            root.ciclo = d.ciclo || root.ciclo;
            root.proximaAvaliacao = d.proximaAvaliacao || null;
            root.avaliacoes = d.avaliacoes || [];
            root.prazos = d.prazos || [];
            root.revisoes = d.revisoes || [];
            root.anki = d.anki || [];
            root.disciplinas = d.disciplinas || [];
            root.historico = d.historico || [];
            root.carregado = true;
        } catch (e) {
            console.warn("[VaultAcademico] JSON:", e);
        }
    }

    Process {
        id: procLeitura
        command: ["/usr/bin/python3", root.scriptPython, "status", root.caminhoVault]
        stdout: StdioCollector {
            onStreamFinished: {
                root.carregando = false;
                root.aplicarDados(text);
            }
        }
    }

    Process {
        id: procAcao
        stdout: StdioCollector {
            onStreamFinished: {
                root.carregando = false;
                root.aplicarDados(text);
            }
        }
    }

    Process {
        id: procAnki
    }

    function atualizar() {
        if (procLeitura.running || procAcao.running)
            return;
        root.carregando = true;
        procLeitura.command = ["/usr/bin/python3", root.scriptPython, "status", root.caminhoVault];
        procLeitura.running = true;
    }

    function mudarAba(aba) {
        root.abaAtual = aba;
        PluginService.savePluginData("vaultAcademico", "abaAtual", aba);
    }

    // ───────────────────────────── Ações na Vault e Pomodoro ─────────────────────────────

    function iniciarPomodoroEm(caminho, titulo) {
        if (!caminho)
            return;
        if (root.pomodoro) {
            const mesma = root.pomodoro.taskPath === caminho;
            root.pomodoro.escolherTarefa(caminho, titulo || caminho.split("/").pop().replace(/\.md$/i, ""));
            if (!mesma && root.pomodoro.isRunning) {
                root.pomodoro.stop();
                iniciarPomodoroAposStop.restart();
            } else {
                root.pomodoro.togglePlayPause();
            }
            return;
        }
        abrirNota(caminho);
    }

    Timer {
        id: iniciarPomodoroAposStop
        interval: 350
        onTriggered: {
            if (root.pomodoro && !root.pomodoro.isRunning)
                root.pomodoro.togglePlayPause();
        }
    }

    function iniciarProximaSessao() {
        if (root.proximaSessao && root.proximaSessao.razaoPath) {
            const s = root.proximaSessao;
            iniciarPomodoroEm(s.razaoPath, s.cod + " Estudo " + root.semestre);
        } else if (root.disciplinas.length > 0) {
            const d = root.disciplinas[0];
            iniciarPomodoroEm(d.razaoPath, d.cod + " Estudo " + root.semestre);
        }
    }

    function registrarEstudo(dados) {
        if (procAcao.running)
            return;
        root.carregando = true;
        procAcao.command = ["/usr/bin/python3", root.scriptPython, "registrar", root.caminhoVault, JSON.stringify(dados)];
        procAcao.running = true;
    }

    function statusRevisao(id, novoStatus) {
        if (procAcao.running)
            return;
        root.carregando = true;
        procAcao.command = ["/usr/bin/python3", root.scriptPython, "revisao", root.caminhoVault, String(id), String(novoStatus)];
        procAcao.running = true;
    }

    function recomecarCiclo() {
        if (procAcao.running)
            return;
        root.carregando = true;
        procAcao.command = ["/usr/bin/python3", root.scriptPython, "recomecar_ciclo", root.caminhoVault];
        procAcao.running = true;
    }

    function pularSessao(sessionId) {
        if (procAcao.running)
            return;
        root.carregando = true;
        procAcao.command = ["/usr/bin/python3", root.scriptPython, "pular_sessao", root.caminhoVault, sessionId || ""];
        procAcao.running = true;
    }

    function focarSessao(sessionId) {
        if (procAcao.running || !sessionId)
            return;
        root.carregando = true;
        procAcao.command = ["/usr/bin/python3", root.scriptPython, "focar_sessao", root.caminhoVault, String(sessionId)];
        procAcao.running = true;
    }

    function replanejarCiclo(dados) {
        if (procAcao.running)
            return;
        root.carregando = true;
        procAcao.command = ["/usr/bin/python3", root.scriptPython, "replanejar_ciclo", root.caminhoVault, JSON.stringify(dados)];
        procAcao.running = true;
    }

    function concluirTarefa(relPath) {
        if (procAcao.running || !relPath)
            return;
        root.carregando = true;
        procAcao.command = ["/usr/bin/python3", root.scriptPython, "concluir_tarefa", root.caminhoVault, relPath];
        procAcao.running = true;
    }

    function alternarTopico(topicId) {
        if (procAcao.running || !topicId)
            return;
        root.carregando = true;
        procAcao.command = ["/usr/bin/python3", root.scriptPython, "alternar_topico", root.caminhoVault, topicId];
        procAcao.running = true;
    }

    function confirmarEstudo(relPath, studyId, aceitar) {
        if (procAcao.running || !relPath || !studyId)
            return;
        root.carregando = true;
        procAcao.command = ["/usr/bin/python3", root.scriptPython, "confirmar_estudo", root.caminhoVault, relPath, studyId, aceitar ? "true" : "false"];
        procAcao.running = true;
    }

    function revisarAnki(baralho) {
        if (procAnki.running)
            return;
        procAnki.command = ["/usr/bin/python3", root.scriptPython, "anki_revisar", baralho || ""];
        procAnki.running = true;
    }

    function focusObsidian() {
        if (root.pluginData?.autoFocusObsidian === false)
            return;
        const achar = "niri msg -j windows 2>/dev/null | jq -r 'first(.[] | select((.app_id // \"\") | test(\"obsidian\"; \"i\")) | .id) // empty'";
        Quickshell.execDetached(["bash", "-c", "for i in $(seq 40); do id=$(" + achar + "); if [ -n \"$id\" ]; then niri msg action focus-window --id \"$id\"; exit 0; fi; sleep 0.25; done"]);
    }

    function abrirNota(relPath) {
        if (!relPath)
            return;
        Quickshell.execDetached(["xdg-open", "obsidian://open?vault=" + encodeURIComponent(root.nomeVault) + "&file=" + encodeURIComponent(relPath)]);
        focusObsidian();
    }

    function abrirPainel() {
        abrirNota(root.painelPath);
    }

    function abrirEstudoNota() {
        abrirNota(root.estudoNotaPath);
    }

    // ───────────────────────────── Regras do Niri e Liquid Glass ─────────────────────────────

    readonly property int cantoJanela: 14
    property int versaoFixar: 0
    readonly property bool niriFixar: versaoFixar >= 1
    readonly property bool niriEspessura: versaoFixar >= 2
    readonly property int espessuraLente: root.pluginData?.espessuraLente ?? 20
    property bool niriVerificado: false
    readonly property bool liquidGlass: niriFixar && (root.pluginData?.liquidGlass ?? true)
    readonly property bool transparenteSobreApps: root.pluginData?.transparenteSobreApps ?? true
    readonly property bool acompanharAreas: niriFixar && (root.pluginData?.acompanharAreas ?? true)
    readonly property real opacidadeFundo: (root.pluginData?.opacidade ?? 42) / 100
    readonly property real opacidadeBotoes: (root.pluginData?.opacidadeBotoes ?? 90) / 50
    readonly property string arquivoRegra: Quickshell.env("HOME") + "/.config/niri/dms/vault-academico.kdl"
    readonly property string tituloJanela: "Acadêmico - Vault"

    property var geometriaSalva: PluginService.loadPluginData("vaultAcademico", "geometria", null)
    property var deslocArea: PluginService.loadPluginData("vaultAcademico", "deslocArea", null) || ({ x: 0, y: 20 })
    property int idJanela: -1
    property var geoJanela: null
    property var esperado: null
    property int regrasEscritas: 0
    property int regrasCarregadas: 0
    property real ultimaEscrita: 0
    property var deslocEscrito: ({ x: 0, y: 20 })

    function efeitoFundo() {
        if (!liquidGlass)
            return "        blur true\n" + (transparenteSobreApps ? "        xray false\n" : "");
        return "        blur false\n        xray false\n        refraction 1\n        dispersion 0.6\n        specular 0.5\n"
            + (niriEspessura ? "        thickness " + espessuraLente + "\n" : "");
    }

    function regraNiri() {
        const c = root.cantoJanela;
        const g = root.geometriaSalva || { x: 56, y: 190, w: 420, h: 500 };
        const pos = g.x === undefined ? ""
            : "    default-floating-position x=" + Math.round(g.x - root.deslocArea.x) + " y=" + Math.round(g.y - root.deslocArea.y) + " relative-to=\"top-left\"\n";
        return "// Gerado pelo plugin vaultAcademico do DMS: lugar, tamanho e vidro da janela.\n"
            + "window-rule {\n"
            + "    match title=\"^" + root.tituloJanela + "\"\n"
            + "    open-floating true\n"
            + "    default-column-width { fixed " + Math.round(g.w) + "; }\n"
            + "    default-window-height { fixed " + Math.round(g.h) + "; }\n"
            + pos
            + "    geometry-corner-radius " + c + " " + c + " " + c + " " + c + "\n"
            + "    clip-to-geometry true\n"
            + "    focus-ring { off; }\n"
            + "    border { off; }\n"
            + (acompanharAreas ? "    sticky true\n" : "")
            + "    background-effect {\n" + efeitoFundo() + "    }\n"
            + "}\n";
    }

    function escreverRegra() {
        if (!niriVerificado)
            return false;
        const texto = regraNiri();
        if (arquivoRegraView.loaded && arquivoRegraView.text() === texto)
            return false;
        NiriService.suppressNextToast();
        arquivoRegraView.setText(texto);
        root.regrasEscritas++;
        root.ultimaEscrita = Date.now();
        root.deslocEscrito = root.deslocArea;
        return true;
    }

    function regraEmVigor() {
        return root.regrasCarregadas >= root.regrasEscritas || Date.now() - root.ultimaEscrita > 1500;
    }

    onLiquidGlassChanged: escreverRegra()
    onEspessuraLenteChanged: escreverRegra()
    onTransparenteSobreAppsChanged: escreverRegra()
    onAcompanharAreasChanged: escreverRegra()

    FileView {
        id: arquivoRegraView
        path: root.arquivoRegra
        printErrors: false
        onLoaded: root.escreverRegra()
        onLoadFailed: root.escreverRegra()
    }

    Process {
        id: versaoNiri
        running: true
        command: ["niri", "msg", "version"]
        stdout: StdioCollector {
            onStreamFinished: {
                const linha = text.split("\n").find(l => l.startsWith("Compositor version")) || "";
                const m = /-fixar(\d*)/.exec(linha);
                root.versaoFixar = m ? (m[1] ? parseInt(m[1]) : 1) : 0;
                root.niriVerificado = true;
                root.escreverRegra();
                if (root.pluginData?.abrirAoIniciar ?? false)
                    abrirInicialTimer.start();
            }
        }
    }

    Timer {
        id: abrirInicialTimer
        interval: 600
        onTriggered: root.showWindow()
    }

    function sinal(n) {
        n = Math.round(n);
        return (n >= 0 ? "+" : "") + n;
    }

    Process {
        id: eventosNiri
        running: academicoWin.visible
        command: ["niri", "msg", "-j", "event-stream"]
        stdout: SplitParser {
            onRead: linha => root.eventoNiri(linha)
        }
    }

    function geoDe(layout) {
        const p = layout?.tile_pos_in_workspace_view;
        const s = layout?.window_size;
        if (!p || !s)
            return null;
        return { x: Math.round(p[0]), y: Math.round(p[1]), w: s[0], h: s[1] };
    }

    function registrarJanela(w) {
        const t = w.title || "";
        if (t.startsWith(root.tituloJanela)) {
            root.idJanela = w.id;
            mudouJanela(geoDe(w.layout));
        }
    }

    function eventoNiri(linha) {
        let e;
        try {
            e = JSON.parse(linha);
        } catch (err) {
            return;
        }
        if (e.WindowsChanged) {
            for (const w of e.WindowsChanged.windows)
                registrarJanela(w);
        } else if (e.WindowOpenedOrChanged) {
            registrarJanela(e.WindowOpenedOrChanged.window);
        } else if (e.WindowLayoutsChanged) {
            for (const par of e.WindowLayoutsChanged.changes) {
                if (par[0] === root.idJanela)
                    mudouJanela(geoDe(par[1]));
            }
        } else if (e.WindowClosed) {
            if (e.WindowClosed.id === root.idJanela) {
                root.idJanela = -1;
                root.geoJanela = null;
            }
        } else if (e.ConfigLoaded) {
            if (!e.ConfigLoaded.failed)
                root.regrasCarregadas = root.regrasEscritas;
        }
    }

    function mudouJanela(g) {
        if (!g)
            return;
        root.geoJanela = g;
        conferirAbertura();
        assentar.restart();
    }

    function calibrar(dx, dy) {
        if ((!dx && !dy) || Math.abs(dx) > 300 || Math.abs(dy) > 300)
            return;
        root.deslocArea = { x: root.deslocEscrito.x - dx, y: root.deslocEscrito.y - dy };
        PluginService.savePluginData("vaultAcademico", "deslocArea", root.deslocArea);
    }

    function conferirAbertura() {
        const e = root.esperado;
        const g = root.geoJanela;
        if (!e || !g || root.idJanela < 0)
            return;
        root.esperado = null;
        const dx = e.x - g.x;
        const dy = e.y - g.y;
        if (e.regraValida)
            calibrar(dx, dy);
        let cmd = "";
        if (Math.abs(g.w - e.w) > 1)
            cmd += "niri msg action set-window-width --id " + root.idJanela + " " + Math.round(e.w) + "; ";
        if (Math.abs(g.h - e.h) > 1)
            cmd += "niri msg action set-window-height --id " + root.idJanela + " " + Math.round(e.h) + "; ";
        if (dx || dy)
            cmd += "niri msg action move-floating-window --id " + root.idJanela + " -x " + sinal(dx) + " -y " + sinal(dy);
        if (cmd)
            Quickshell.execDetached(["bash", "-c", cmd]);
    }

    Timer {
        id: assentar
        interval: 800
        onTriggered: {
            if (!academicoWin.visible || !root.geoJanela)
                return;
            const g = root.geoJanela;
            root.geometriaSalva = { x: g.x, y: g.y, w: g.w, h: g.h };
            PluginService.savePluginData("vaultAcademico", "geometria", root.geometriaSalva);
            root.escreverRegra();
        }
    }

    Process {
        id: lerGeometria
        command: ["bash", "-c", "niri msg -j windows | jq -c 'first(.[] | select(.title | startswith(\"" + root.tituloJanela + "\")) | {x: .layout.tile_pos_in_workspace_view[0], y: .layout.tile_pos_in_workspace_view[1], w: .layout.window_size[0], h: .layout.window_size[1]}) // empty'"]
        stdout: StdioCollector {
            onStreamFinished: {
                try {
                    const g = JSON.parse(text);
                    if (g && g.w > 0 && g.h > 0)
                        root.recolher({ x: Math.round(g.x), y: Math.round(g.y), w: g.w, h: g.h });
                    else
                        root.recolher(null);
                } catch (e) {
                    root.recolher(null);
                }
            }
        }
    }

    function recolher(g) {
        if (g) {
            root.geometriaSalva = g;
            PluginService.savePluginData("vaultAcademico", "geometria", g);
        }
        root.escreverRegra();
        academicoWin.visible = false;
    }

    function toggleWindow() {
        if (academicoWin.visible)
            hideWindow();
        else
            showWindow();
    }

    function showWindow() {
        if (academicoWin.visible)
            return;
        const g = root.geometriaSalva;
        root.esperado = g && g.x !== undefined ? { x: g.x, y: g.y, w: g.w, h: g.h, regraValida: root.regraEmVigor() } : null;
        root.idJanela = -1;
        root.geoJanela = null;
        root.atualizar();
        academicoWin.visible = true;
    }

    function hideWindow() {
        if (!academicoWin.visible || lerGeometria.running)
            return;
        if (root.geoJanela)
            recolher({ x: root.geoJanela.x, y: root.geoJanela.y, w: root.geoJanela.w, h: root.geoJanela.h });
        else
            lerGeometria.running = true;
    }

    // dms ipc call vaultAcademico <cmd>
    IpcHandler {
        target: "vaultAcademico"

        function toggle(): string {
            root.toggleWindow();
            return root.windowVisible ? "opened" : "collapsed";
        }

        function show(): string {
            root.showWindow();
            return "opened";
        }

        function hide(): string {
            root.hideWindow();
            return "collapsed";
        }

        function startNext(): string {
            root.iniciarProximaSessao();
            return "started";
        }

        function skipNext(): string {
            root.pularSessao("");
            return "skipped";
        }

        function openDashboard(): string {
            root.abrirPainel();
            return "dashboard-opened";
        }

        function refresh(): string {
            root.atualizar();
            return "refreshed";
        }
    }

    FloatingWindow {
        id: academicoWin

        title: root.tituloJanela
        minimumSize: Qt.size(250, 130)
        implicitWidth: 420
        implicitHeight: 500
        color: "transparent"
        visible: false

        onClosed: academicoWin.visible = false

        JanelaAcademico {
            anchors.fill: parent
            d: root
            canto: root.cantoJanela
            opacidadeCartao: root.opacidadeFundo
            opacidadeBotoes: root.opacidadeBotoes
            onFechar: root.hideWindow()
            onArrastar: windowControls.tryStartMove()
            onAlternarMaximizar: windowControls.tryToggleMaximize()
            onAbrirConfig: PopoutService.focusOrToggleSettingsWithTab("plugins")
        }

        FloatingWindowControls {
            id: windowControls
            targetWindow: academicoWin
        }
    }
}
