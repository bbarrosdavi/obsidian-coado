import QtQuick
import QtQuick.Layouts
import qs.Common
import qs.Widgets

// Conteúdo do widget desktop do sistema acadêmico da vault.
// Funciona tanto dentro da FloatingWindow (Liquid Glass do niri) quanto no DesktopPluginComponent.
Item {
    id: j

    required property var d

    property bool modoDesktopLayer: false
    property real canto: 14
    property real opacidadeCartao: 0.14
    property real opacidadeBotoes: 1.8

    signal fechar
    signal arrastar
    signal alternarMaximizar
    signal abrirConfig

    readonly property real s: Math.max(0.82, Math.min(1.45, Math.min(width / 365, height / 440)))
    readonly property real margem: Math.round(9 * s)
    readonly property real espaco: Math.round(6 * s)
    readonly property real raioInterno: Math.max(4, Math.round(canto - margem * 0.55))
    readonly property bool compacto: height < 235
    readonly property bool emFoco: hoverJanela.hovered

    readonly property color texto: Theme.surfaceText
    readonly property color textoFraco: Qt.rgba(Theme.surfaceText.r, Theme.surfaceText.g, Theme.surfaceText.b, 0.62)
    readonly property color textoMuitoFraco: Qt.rgba(Theme.surfaceText.r, Theme.surfaceText.g, Theme.surfaceText.b, 0.42)
    readonly property color corCartao: Qt.rgba(Theme.surfaceContainer.r, Theme.surfaceContainer.g, Theme.surfaceContainer.b, opacidadeCartao)
    readonly property color corOk: "#10b981"
    readonly property color corErro: Theme.error
    readonly property color corAviso: Theme.warning

    readonly property var prox: d?.proximaSessao ?? null
    readonly property var res: d?.resumo ?? ({})
    readonly property var aval: d?.proximaAvaliacao ?? null

    // Formulário rápido de registro de estudo
    property bool registroAberto: false
    property string regSubjId: ""
    property string regCatId: "teoria"
    property int regMinutos: 50
    property int regAcertos: 0
    property int regErros: 0
    property bool regCiclo: true
    property bool regAgendarRev: true
    property string regReviewId: ""
    property string regTopicId: ""

    // Editor rápido de disciplinas do ciclo
    property bool replanejarAberto: false
    property var replanejarCods: []
    property int replanejarHoras: 16

    function abrirReplanejar() {
        const ativas = j.d.ciclo?.disciplinasNoCiclo;
        if (ativas && ativas.length > 0)
            j.replanejarCods = ativas.slice();
        else
            j.replanejarCods = j.d.disciplinas.map(x => x.cod);
        j.replanejarHoras = Math.max(1, Math.round((j.d.ciclo?.minutosSemana || 960) / 60));
        j.replanejarAberto = true;
    }

    function alternarCodCiclo(cod) {
        const idx = j.replanejarCods.indexOf(cod);
        const copia = j.replanejarCods.slice();
        if (idx >= 0) {
            if (copia.length > 1)
                copia.splice(idx, 1);
        } else {
            copia.push(cod);
        }
        j.replanejarCods = copia;
    }

    function salvarReplanejar() {
        j.d.replanejarCiclo({
            disciplinasAtivas: j.replanejarCods,
            minutosSemana: j.replanejarHoras * 60
        });
        j.replanejarAberto = false;
    }

    function abrirRegistroPara(subjId, minutos, catId, reviewId, topicId) {
        j.regSubjId = subjId || (j.prox ? j.prox.subjectId : (j.d.disciplinas.length > 0 ? j.d.disciplinas[0].id : "elt75a"));
        j.regMinutos = minutos || (j.prox ? j.prox.restanteMin : 50);
        j.regCatId = catId || "teoria";
        j.regReviewId = reviewId || "";
        j.regTopicId = topicId || "";
        j.regAcertos = 0;
        j.regErros = 0;
        j.regCiclo = true;
        j.regAgendarRev = !reviewId;
        j.registroAberto = true;
    }

    function salvarRegistro() {
        if (!j.regSubjId || j.regMinutos <= 0)
            return;
        j.d.registrarEstudo({
            subjectId: j.regSubjId,
            categoryId: j.regCatId,
            topicId: j.regTopicId,
            minutos: j.regMinutos,
            hits: j.regAcertos,
            misses: j.regErros,
            countInPlanning: j.regCiclo,
            agendarRevisoes: j.regAgendarRev,
            reviewId: j.regReviewId
        });
        j.registroAberto = false;
    }

    HoverHandler {
        id: hoverJanela
    }

    Cartao {
        anchors.fill: parent
        cantos: [j.canto, j.canto, j.canto, j.canto]
        cor: j.corCartao
        corBorda: Qt.rgba(Theme.outline.r, Theme.outline.g, Theme.outline.b, 0.22)
    }

    // Ícone clicável compacto
    component Zona: Item {
        id: z
        property string icone: ""
        property real tamanho: Math.round(14 * j.s)
        property color corIcone: j.texto
        signal clicked
        implicitWidth: Math.round(24 * j.s)
        implicitHeight: implicitWidth

        Rectangle {
            anchors.fill: parent
            radius: j.raioInterno
            color: Qt.rgba(1, 1, 1, (zArea.pressed ? 0.14 : (zArea.containsMouse ? 0.08 : 0)) * j.opacidadeBotoes)
            Behavior on color { ColorAnimation { duration: 100 } }
        }

        DankIcon {
            anchors.centerIn: parent
            name: z.icone
            size: z.tamanho
            color: z.corIcone
            opacity: zArea.containsMouse ? 0.98 : 0.68
        }

        MouseArea {
            id: zArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: z.clicked()
        }
    }

    // Ponto colorido de disciplina
    component PontoCor: Rectangle {
        property color corPonto: Theme.primary
        property real tam: Math.round(8 * j.s)
        width: tam
        height: tam
        radius: tam / 2
        color: corPonto
        Layout.preferredWidth: tam
        Layout.preferredHeight: tam
    }

    // Barra de progresso horizontal fina
    component BarraProgresso: Rectangle {
        property real valor: 0 // 0 a 100
        property color corBarra: Theme.primary
        property real alturaBarra: Math.max(3, Math.round(4 * j.s))
        Layout.fillWidth: true
        height: alturaBarra
        Layout.preferredHeight: alturaBarra
        radius: alturaBarra / 2
        color: Qt.rgba(Theme.surfaceText.r, Theme.surfaceText.g, Theme.surfaceText.b, 0.12)

        Rectangle {
            width: parent.width * Math.max(0, Math.min(1, parent.valor / 100))
            height: parent.height
            radius: parent.radius
            color: parent.corBarra
            Behavior on width { NumberAnimation { duration: 180; easing.type: Easing.OutCubic } }
        }
    }

    // ───────────────────────────── Conteúdo Principal ─────────────────────────────

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: j.margem
        anchors.topMargin: barra.aberta ? (barra.height + Math.round(4 * j.s)) : (j.margem + Math.round(4 * j.s))
        Behavior on anchors.topMargin { NumberAnimation { duration: 150; easing.type: Easing.OutCubic } }
        spacing: j.espaco

        // 1. Cartão Hero: Próxima Sessão do Ciclo (ou Pomodoro Ativo)
        Item {
            id: heroCard
            Layout.fillWidth: true
            Layout.preferredHeight: Math.round(64 * j.s)

            readonly property color corHero: j.prox?.cor ? j.prox.cor : Theme.primary
            readonly property bool pomoNaProxima: !!(j.d.pomodoroSessao && j.prox && j.d.pomodoroTarefaPath === j.prox.razaoPath)

            Vidro {
                anchors.fill: parent
                raio: j.raioInterno
                intensidade: 0.65
                opacidadeGeral: j.opacidadeBotoes
                realce: heroArea.containsMouse
            }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Math.round(10 * j.s)
                anchors.rightMargin: Math.round(8 * j.s)
                anchors.topMargin: Math.round(7 * j.s)
                anchors.bottomMargin: Math.round(7 * j.s)
                spacing: Math.round(8 * j.s)

                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    spacing: Math.round(3 * j.s)

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: Math.round(6 * j.s)

                        PontoCor {
                            corPonto: heroCard.corHero
                            tam: Math.round(9 * j.s)
                        }

                        Text {
                            text: j.d.pomodoroSessao
                                ? ("POMODORO · " + (j.d.pomodoroRodando ? "ATIVO" : "PAUSADO"))
                                : (j.prox ? ("PRÓXIMA DO CICLO · #" + j.prox.pos) : "CICLO CONCLUÍDO")
                            font.family: j.d.fonte
                            font.pixelSize: Math.round(9.5 * j.s)
                            font.weight: Font.Bold
                            font.letterSpacing: 0.5
                            color: j.d.pomodoroRodando ? Theme.primary : j.textoFraco
                        }

                        Zona {
                            visible: !!j.prox && !j.d.pomodoroSessao
                            icone: "skip_next"
                            tamanho: Math.round(13 * j.s)
                            implicitWidth: Math.round(18 * j.s)
                            implicitHeight: Math.round(16 * j.s)
                            corIcone: j.textoFraco
                            onClicked: j.d.pularSessao(j.prox?.id || "")
                        }

                        Item { Layout.fillWidth: true }

                        Text {
                            text: j.d.pomodoroSessao
                                ? j.d.pomodoroTempo
                                : (j.prox ? (j.prox.estudadoTexto + " / " + j.prox.duracaoTexto) : "")
                            font.family: j.d.fonte
                            font.features: ({ "tnum": 1 })
                            font.pixelSize: Math.round(11 * j.s)
                            font.weight: j.d.pomodoroSessao ? Font.Bold : Font.Medium
                            color: j.d.pomodoroSessao ? Theme.primary : j.textoFraco
                        }
                    }

                    Item {
                        Layout.fillWidth: true
                        Layout.fillHeight: true

                        Text {
                            anchors.verticalCenter: parent.verticalCenter
                            width: parent.width
                            text: j.d.pomodoroSessao && j.d.pomodoroTarefaTitulo
                                ? j.d.pomodoroTarefaTitulo
                                : (j.prox ? (j.prox.cod + " · " + j.prox.titulo) : "Todas as sessões feitas — recomeçar ciclo")
                            font.family: j.d.fonte
                            font.pixelSize: Math.round(12.5 * j.s)
                            font.weight: Font.DemiBold
                            color: j.texto
                            elide: Text.ElideRight
                            maximumLineCount: 1
                        }

                        MouseArea {
                            id: heroArea
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                if (j.d.pomodoroSessao && j.d.pomodoroTarefaPath)
                                    j.d.abrirNota(j.d.pomodoroTarefaPath);
                                else if (j.prox?.notaPath)
                                    j.d.abrirNota(j.prox.notaPath);
                                else
                                    j.d.abrirPainel();
                            }
                        }
                    }

                    BarraProgresso {
                        valor: j.d.pomodoroSessao
                            ? Math.round(j.d.pomodoroProgresso * 100)
                            : (j.prox ? j.prox.pct : 100)
                        corBarra: j.d.pomodoroSessao ? Theme.primary : heroCard.corHero
                    }
                }

                // Botões de ação rápida da próxima sessão
                RowLayout {
                    spacing: Math.round(4 * j.s)

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        icone: (j.d.pomodoroRodando && (heroCard.pomoNaProxima || j.d.pomodoroSessao)) ? "pause" : "play_arrow"
                        altura: Math.round(30 * j.s)
                        tamanhoIcone: Math.round(17 * j.s)
                        corConteudo: heroCard.corHero
                        onClicked: {
                            if (j.d.pomodoroSessao)
                                j.d.pomodoro.togglePlayPause();
                            else
                                j.d.iniciarProximaSessao();
                        }
                    }

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        icone: j.registroAberto ? "expand_less" : "add"
                        raio: j.raioInterno
                        altura: Math.round(30 * j.s)
                        tamanhoIcone: Math.round(16 * j.s)
                        onClicked: {
                            if (j.registroAberto)
                                j.registroAberto = false;
                            else
                                j.abrirRegistroPara(j.prox?.subjectId || "", j.prox?.restanteMin || 50, "teoria", "", "");
                        }
                    }
                }
            }
        }

        // 2. Faixa dos 4 indicadores rápidos (visível também no modo compacto se houver altura >= 170)
        RowLayout {
            Layout.fillWidth: true
            visible: j.height >= 175
            spacing: Math.round(5 * j.s)

            // Semana
            Item {
                Layout.fillWidth: true
                Layout.preferredWidth: 1
                Layout.preferredHeight: Math.round(58 * j.s)

                Vidro {
                    anchors.fill: parent
                    raio: j.raioInterno
                    intensidade: 0.45
                    opacidadeGeral: j.opacidadeBotoes
                }

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: Math.round(7 * j.s)
                    spacing: Math.round(2 * j.s)

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 3
                        Text {
                            text: "SEMANA"
                            font.family: j.d.fonte
                            font.pixelSize: Math.round(8.5 * j.s)
                            font.weight: Font.Bold
                            color: j.textoFraco
                        }
                        Item { Layout.fillWidth: true }
                        Text {
                            text: (j.res.metaPct || 0) + "%"
                            font.family: j.d.fonte
                            font.features: ({ "tnum": 1 })
                            font.pixelSize: Math.round(8.5 * j.s)
                            color: j.textoFraco
                        }
                    }

                    Text {
                        text: (j.res.semanaTexto || "0h") + " / " + (j.res.metaTexto || "16h")
                        font.family: j.d.fonte
                        font.features: ({ "tnum": 1 })
                        font.pixelSize: Math.round(12 * j.s)
                        font.weight: Font.Bold
                        color: (j.res.metaPct || 0) >= 100 ? j.corOk : Theme.primary
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }

                    Item { Layout.fillHeight: true }

                    BarraProgresso {
                        valor: j.res.metaPct || 0
                        corBarra: (j.res.metaPct || 0) >= 100 ? j.corOk : Theme.primary
                        alturaBarra: Math.max(3, Math.round(3.5 * j.s))
                    }
                }
            }

            // Constância
            Item {
                Layout.fillWidth: true
                Layout.preferredWidth: 1
                Layout.preferredHeight: Math.round(58 * j.s)

                Vidro {
                    anchors.fill: parent
                    raio: j.raioInterno
                    intensidade: 0.45
                    opacidadeGeral: j.opacidadeBotoes
                }

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: Math.round(7 * j.s)
                    spacing: Math.round(2 * j.s)

                    Text {
                        text: "SEQUÊNCIA"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(8.5 * j.s)
                        font.weight: Font.Bold
                        color: j.textoFraco
                    }

                    Text {
                        text: (j.res.sequencia || 0) > 0
                            ? (j.res.sequencia + (j.res.sequencia === 1 ? " dia" : " dias"))
                            : ((j.res.diasSemEstudar || 0) + "d sem")
                        font.family: j.d.fonte
                        font.features: ({ "tnum": 1 })
                        font.pixelSize: Math.round(12 * j.s)
                        font.weight: Font.Bold
                        color: (j.res.sequencia || 0) > 0 ? j.corOk : j.corErro
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }

                    Item { Layout.fillHeight: true }

                    Text {
                        text: (j.res.estudouHoje ? "✓ hoje" : "pendente") + " · rec " + (j.res.recorde || 0) + "d"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(8.5 * j.s)
                        lineHeight: 0.92
                        color: j.textoFraco
                        wrapMode: Text.WordWrap
                        maximumLineCount: 2
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }
            }

            // Revisões & Prazos Hoje
            Item {
                Layout.fillWidth: true
                Layout.preferredWidth: 1
                Layout.preferredHeight: Math.round(58 * j.s)

                Vidro {
                    anchors.fill: parent
                    raio: j.raioInterno
                    intensidade: 0.45
                    opacidadeGeral: j.opacidadeBotoes
                    realce: cardHojeMouse.containsMouse
                }

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: Math.round(7 * j.s)
                    spacing: Math.round(2 * j.s)

                    Text {
                        text: "PENDÊNCIAS"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(8.5 * j.s)
                        font.weight: Font.Bold
                        color: j.textoFraco
                    }

                    Text {
                        readonly property int totRev: (j.res.revisoesHoje || 0) + (j.res.ankiHoje || 0)
                        text: (j.res.atrasados || 0) > 0
                            ? (j.res.atrasados + (j.res.atrasados === 1 ? " atrasado" : " atrasados"))
                            : (totRev > 0 ? (totRev + " rev hoje") : ((j.res.prazosSemana || 0) + " na sem."))
                        font.family: j.d.fonte
                        font.features: ({ "tnum": 1 })
                        font.pixelSize: Math.round(12 * j.s)
                        font.weight: Font.Bold
                        color: (j.res.atrasados || 0) > 0
                            ? j.corErro
                            : (((j.res.revisoesHoje || 0) + (j.res.ankiHoje || 0)) > 0 ? j.corAviso : j.corOk)
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }

                    Item { Layout.fillHeight: true }

                    Text {
                        text: (j.res.ankiHoje || 0) > 0
                            ? ("+" + j.res.ankiHoje + " Anki · " + (j.res.prazosSemana || 0) + " sem.")
                            : ((j.res.prazosSemana || 0) + " prazo(s) 7d")
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(8.5 * j.s)
                        lineHeight: 0.92
                        color: j.textoFraco
                        wrapMode: Text.WordWrap
                        maximumLineCount: 2
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }

                MouseArea {
                    id: cardHojeMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: j.d.mudarAba((j.res.atrasados || 0) > 0 ? "prazos" : "revisoes")
                }
            }

            // Próxima Avaliação
            Item {
                Layout.fillWidth: true
                Layout.preferredWidth: 1
                Layout.preferredHeight: Math.round(58 * j.s)

                Vidro {
                    anchors.fill: parent
                    raio: j.raioInterno
                    intensidade: 0.45
                    opacidadeGeral: j.opacidadeBotoes
                    realce: cardAvalMouse.containsMouse
                }

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: Math.round(7 * j.s)
                    spacing: Math.round(2 * j.s)

                    Text {
                        text: "AVALIAÇÃO"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(8.5 * j.s)
                        font.weight: Font.Bold
                        color: j.textoFraco
                    }

                    Text {
                        text: j.aval ? (j.aval.dias === 0 ? "Hoje!" : (j.aval.dias + " dias")) : "—"
                        font.family: j.d.fonte
                        font.features: ({ "tnum": 1 })
                        font.pixelSize: Math.round(12 * j.s)
                        font.weight: Font.Bold
                        color: j.aval && j.aval.dias <= 7 ? j.corErro : Theme.primary
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }

                    Item { Layout.fillHeight: true }

                    Text {
                        text: j.aval ? (j.aval.cod + " · " + j.aval.dataCurta) : "Sem provas"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(8.5 * j.s)
                        lineHeight: 0.92
                        color: j.textoFraco
                        wrapMode: Text.WordWrap
                        maximumLineCount: 2
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }

                MouseArea {
                    id: cardAvalMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: j.d.mudarAba("prazos")
                }
            }
        }

        // 3. Gaveta de Registro Rápido de Estudo (expansível)
        Item {
            Layout.fillWidth: true
            visible: j.registroAberto && !j.compacto
            Layout.preferredHeight: Math.round(138 * j.s)

            Vidro {
                anchors.fill: parent
                raio: j.raioInterno
                intensidade: 0.75
                opacidadeGeral: j.opacidadeBotoes
            }

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: Math.round(8 * j.s)
                spacing: Math.round(5 * j.s)

                RowLayout {
                    Layout.fillWidth: true
                    spacing: Math.round(4 * j.s)

                    Text {
                        text: "REGISTRAR ESTUDO"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(9.5 * j.s)
                        font.weight: Font.Bold
                        color: j.textoFraco
                    }

                    Item { Layout.fillWidth: true }

                    Repeater {
                        model: [
                            { id: "teoria", nome: "Teoria" },
                            { id: "questoes", nome: "Questões" },
                            { id: "revisao", nome: "Revisão" },
                            { id: "execucao", nome: "Exec." }
                        ]
                        delegate: BotaoVidro {
                            required property var modelData
                            opacidadeGeral: j.opacidadeBotoes
                            texto: modelData.nome
                            raio: j.raioInterno
                            destaque: j.regCatId === modelData.id
                            altura: Math.round(20 * j.s)
                            tamanhoTexto: Math.round(9.5 * j.s)
                            folga: Math.round(6 * j.s)
                            onClicked: j.regCatId = modelData.id
                        }
                    }
                }

                // Seletor de disciplina
                RowLayout {
                    Layout.fillWidth: true
                    spacing: Math.round(4 * j.s)

                    Repeater {
                        model: j.d.disciplinas
                        delegate: BotaoVidro {
                            required property var modelData
                            opacidadeGeral: j.opacidadeBotoes
                            texto: modelData.cod
                            raio: j.raioInterno
                            destaque: j.regSubjId === modelData.id
                            corDestaque: modelData.cor || Theme.primary
                            altura: Math.round(22 * j.s)
                            tamanhoTexto: Math.round(9.5 * j.s)
                            folga: Math.round(6 * j.s)
                            onClicked: j.regSubjId = modelData.id
                        }
                    }
                }

                // Tempo e Questões
                RowLayout {
                    Layout.fillWidth: true
                    spacing: Math.round(4 * j.s)

                    Text {
                        text: "Tempo:"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(10 * j.s)
                        color: j.textoFraco
                    }

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        texto: "-15"
                        raio: j.raioInterno
                        altura: Math.round(22 * j.s)
                        tamanhoTexto: Math.round(9.5 * j.s)
                        folga: Math.round(5 * j.s)
                        onClicked: j.regMinutos = Math.max(5, j.regMinutos - 15)
                    }

                    Text {
                        text: j.regMinutos + " min"
                        font.family: j.d.fonte
                        font.features: ({ "tnum": 1 })
                        font.pixelSize: Math.round(11 * j.s)
                        font.weight: Font.Bold
                        color: j.texto
                    }

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        texto: "+15"
                        raio: j.raioInterno
                        altura: Math.round(22 * j.s)
                        tamanhoTexto: Math.round(9.5 * j.s)
                        folga: Math.round(5 * j.s)
                        onClicked: j.regMinutos = Math.min(300, j.regMinutos + 15)
                    }

                    Item { Layout.fillWidth: true }

                    Text {
                        text: "A/E:"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(10 * j.s)
                        color: j.textoFraco
                    }

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        texto: "✓ " + j.regAcertos
                        raio: j.raioInterno
                        altura: Math.round(22 * j.s)
                        tamanhoTexto: Math.round(9.5 * j.s)
                        corConteudo: j.corOk
                        folga: Math.round(6 * j.s)
                        onClicked: j.regAcertos++
                    }

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        texto: "✕ " + j.regErros
                        raio: j.raioInterno
                        altura: Math.round(22 * j.s)
                        tamanhoTexto: Math.round(9.5 * j.s)
                        corConteudo: j.corErro
                        folga: Math.round(6 * j.s)
                        onClicked: j.regErros++
                    }
                }

                // Rodapé do registro
                RowLayout {
                    Layout.fillWidth: true
                    spacing: Math.round(5 * j.s)

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        texto: j.regCiclo ? "✓ No ciclo" : "Fora do ciclo"
                        raio: j.raioInterno
                        destaque: j.regCiclo
                        altura: Math.round(22 * j.s)
                        tamanhoTexto: Math.round(9.5 * j.s)
                        folga: Math.round(7 * j.s)
                        onClicked: j.regCiclo = !j.regCiclo
                    }

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        texto: j.regAgendarRev ? "✓ Revisões (1,7,30d)" : "Sem revisão"
                        raio: j.raioInterno
                        destaque: j.regAgendarRev
                        altura: Math.round(22 * j.s)
                        tamanhoTexto: Math.round(9.5 * j.s)
                        folga: Math.round(7 * j.s)
                        onClicked: j.regAgendarRev = !j.regAgendarRev
                    }

                    Item { Layout.fillWidth: true }

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        texto: "Cancelar"
                        raio: j.raioInterno
                        altura: Math.round(22 * j.s)
                        tamanhoTexto: Math.round(9.5 * j.s)
                        folga: Math.round(7 * j.s)
                        onClicked: j.registroAberto = false
                    }

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        texto: "Salvar"
                        raio: j.raioInterno
                        destaque: true
                        altura: Math.round(22 * j.s)
                        tamanhoTexto: Math.round(9.5 * j.s)
                        folga: Math.round(9 * j.s)
                        onClicked: j.salvarRegistro()
                    }
                }
            }
        }

        // 4. Barra de Abas (Ciclo · Prazos · Revisões · Matérias)
        RowLayout {
            Layout.fillWidth: true
            visible: !j.compacto
            spacing: Math.round(4 * j.s)

            Repeater {
                model: [
                    { id: "ciclo", nome: "Ciclo", icone: "autorenew" },
                    { id: "prazos", nome: "Prazos", icone: "event" },
                    { id: "revisoes", nome: "Revisões", icone: "style" },
                    { id: "disciplinas", nome: "Matérias", icone: "school" }
                ]
                delegate: BotaoVidro {
                    required property var modelData
                    Layout.fillWidth: true
                    opacidadeGeral: j.opacidadeBotoes
                    icone: modelData.icone
                    texto: modelData.nome
                    raio: j.raioInterno
                    destaque: j.d.abaAtual === modelData.id
                    altura: Math.round(26 * j.s)
                    tamanhoIcone: Math.round(13 * j.s)
                    tamanhoTexto: Math.round(10.5 * j.s)
                    folga: Math.round(6 * j.s)
                    onClicked: j.d.mudarAba(modelData.id)
                }
            }
        }

        // 5. Área das Abas
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: !j.compacto
            clip: true

            // ═══════════════════════ ABA 1: CICLO & CONSTÂNCIA ═══════════════════════
            ColumnLayout {
                anchors.fill: parent
                visible: j.d.abaAtual === "ciclo"
                spacing: j.espaco

                // Faixa de Constância da Semana (7 cards maiores)
                Item {
                    Layout.fillWidth: true
                    Layout.preferredHeight: Math.round(62 * j.s)

                    Vidro {
                        anchors.fill: parent
                        raio: j.raioInterno
                        intensidade: 0.38
                        opacidadeGeral: j.opacidadeBotoes
                    }

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: Math.round(7 * j.s)
                        anchors.rightMargin: Math.round(7 * j.s)
                        anchors.topMargin: Math.round(5 * j.s)
                        anchors.bottomMargin: Math.round(5 * j.s)
                        spacing: Math.round(5 * j.s)

                        Repeater {
                            model: (j.d.constancia14 && j.d.constancia14.length >= 11)
                                ? j.d.constancia14.slice(4, 11)
                                : j.d.constancia14
                            delegate: ColumnLayout {
                                required property var modelData
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                spacing: Math.round(2 * j.s)

                                Text {
                                    Layout.alignment: Qt.AlignHCenter
                                    text: modelData.diaSemana || ""
                                    font.family: j.d.fonte
                                    font.pixelSize: Math.round(9 * j.s)
                                    font.weight: modelData.hoje ? Font.Bold : Font.DemiBold
                                    color: modelData.hoje ? Theme.primary : j.textoFraco
                                }

                                Rectangle {
                                    Layout.fillWidth: true
                                    Layout.fillHeight: true
                                    radius: Math.round(6 * j.s)
                                    opacity: modelData.futuro ? 0.38 : 1.0
                                    color: modelData.estudou
                                        ? Qt.rgba(0.06, 0.72, 0.50, 0.26)
                                        : (modelData.futuro || modelData.hoje
                                            ? Qt.rgba(1, 1, 1, 0.06)
                                            : Qt.rgba(Theme.error.r, Theme.error.g, Theme.error.b, 0.17))
                                    border.width: modelData.hoje ? 1.5 : 0
                                    border.color: Theme.primary

                                    Text {
                                        anchors.centerIn: parent
                                        text: modelData.estudou ? "✓" : (!modelData.futuro && !modelData.hoje ? "×" : modelData.diaMes)
                                        font.family: j.d.fonte
                                        font.pixelSize: Math.round(12 * j.s)
                                        font.weight: Font.Bold
                                        color: modelData.estudou ? j.corOk : (!modelData.futuro && !modelData.hoje ? j.corErro : j.texto)
                                    }
                                }

                                Text {
                                    Layout.alignment: Qt.AlignHCenter
                                    text: modelData.diaMes || ""
                                    font.family: j.d.fonte
                                    font.features: ({ "tnum": 1 })
                                    font.pixelSize: Math.round(8.5 * j.s)
                                    color: modelData.hoje ? Theme.primary : j.textoMuitoFraco
                                }
                            }
                        }
                    }
                }

                // Cabeçalho do progresso do ciclo
                RowLayout {
                    Layout.fillWidth: true
                    spacing: Math.round(4 * j.s)

                    Text {
                        text: "Ciclo " + ((j.d.ciclo?.ciclosCompletos || 0) + 1)
                            + " · " + (j.d.ciclo?.concluidas || 0) + "/" + (j.d.ciclo?.totalSessoes || 0)
                            + " (" + (j.d.ciclo?.estudadoTexto || "0min") + " / " + (j.d.ciclo?.planejadoTexto || "15h") + ")"
                        font.family: j.d.fonte
                        font.features: ({ "tnum": 1 })
                        font.pixelSize: Math.round(10 * j.s)
                        color: j.textoFraco
                        Layout.fillWidth: true
                        elide: Text.ElideRight
                    }

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        icone: "tune"
                        texto: "Ciclo"
                        destaque: j.replanejarAberto
                        raio: j.raioInterno
                        altura: Math.round(20 * j.s)
                        tamanhoIcone: Math.round(12 * j.s)
                        tamanhoTexto: Math.round(9.5 * j.s)
                        folga: Math.round(6 * j.s)
                        onClicked: {
                            if (j.replanejarAberto)
                                j.replanejarAberto = false;
                            else
                                j.abrirReplanejar();
                        }
                    }

                    BotaoVidro {
                        opacidadeGeral: j.opacidadeBotoes
                        icone: "restart_alt"
                        texto: "Zerar"
                        raio: j.raioInterno
                        altura: Math.round(20 * j.s)
                        tamanhoIcone: Math.round(12 * j.s)
                        tamanhoTexto: Math.round(9.5 * j.s)
                        folga: Math.round(6 * j.s)
                        onClicked: j.d.recomecarCiclo()
                    }
                }

                // Painel de seleção de matérias e horas do ciclo
                Item {
                    Layout.fillWidth: true
                    visible: j.replanejarAberto
                    Layout.preferredHeight: Math.round(64 * j.s)

                    Vidro {
                        anchors.fill: parent
                        raio: j.raioInterno
                        intensidade: 0.72
                        opacidadeGeral: j.opacidadeBotoes
                    }

                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: Math.round(6 * j.s)
                        spacing: Math.round(4 * j.s)

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: Math.round(3 * j.s)

                            Repeater {
                                model: j.d.disciplinas
                                delegate: BotaoVidro {
                                    required property var modelData
                                    Layout.fillWidth: true
                                    opacidadeGeral: j.opacidadeBotoes
                                    texto: modelData.cod
                                    raio: j.raioInterno
                                    destaque: j.replanejarCods.indexOf(modelData.cod) >= 0
                                    corDestaque: modelData.cor || Theme.primary
                                    altura: Math.round(22 * j.s)
                                    tamanhoTexto: Math.round(9 * j.s)
                                    folga: Math.round(4 * j.s)
                                    onClicked: j.alternarCodCiclo(modelData.cod)
                                }
                            }
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: Math.round(5 * j.s)

                            Text {
                                text: "Toque numa sessão abaixo para puxá-la para #1, ou recrie o ciclo:"
                                font.family: j.d.fonte
                                font.pixelSize: Math.round(9 * j.s)
                                color: j.textoFraco
                                Layout.fillWidth: true
                                elide: Text.ElideRight
                            }

                            BotaoVidro {
                                opacidadeGeral: j.opacidadeBotoes
                                texto: "Gerar ciclo"
                                raio: j.raioInterno
                                destaque: true
                                altura: Math.round(20 * j.s)
                                tamanhoTexto: Math.round(9.5 * j.s)
                                folga: Math.round(7 * j.s)
                                onClicked: j.salvarReplanejar()
                            }
                        }
                    }
                }

                // Lista de sessões do ciclo
                ListView {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    spacing: Math.round(4 * j.s)
                    boundsBehavior: Flickable.StopAtBounds
                    model: j.d.ciclo?.sessoes || []

                    delegate: Item {
                        id: sessItem
                        required property var modelData
                        readonly property bool ehProxima: !!(j.prox && j.prox.id === modelData.id)
                        width: ListView.view.width
                        height: Math.round(38 * j.s)
                        opacity: modelData.done ? 0.55 : 1.0

                        Vidro {
                            anchors.fill: parent
                            raio: j.raioInterno
                            intensidade: sessItem.ehProxima ? 0.88 : 0.38
                            opacidadeGeral: j.opacidadeBotoes
                            realce: sessMouse.containsMouse
                        }

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: Math.round(8 * j.s)
                            anchors.rightMargin: Math.round(6 * j.s)
                            spacing: Math.round(5 * j.s)

                            Text {
                                text: String(sessItem.modelData.pos)
                                font.family: j.d.fonte
                                font.features: ({ "tnum": 1 })
                                font.pixelSize: Math.round(10 * j.s)
                                color: sessItem.ehProxima ? Theme.primary : j.textoMuitoFraco
                                font.weight: sessItem.ehProxima ? Font.Bold : Font.Normal
                                Layout.preferredWidth: Math.round(14 * j.s)
                                horizontalAlignment: Text.AlignRight
                            }

                            PontoCor {
                                corPonto: sessItem.modelData.done ? j.corOk : (sessItem.modelData.cor || Theme.primary)
                            }

                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 2

                                RowLayout {
                                    Layout.fillWidth: true
                                    spacing: 4

                                    Text {
                                        Layout.fillWidth: true
                                        text: sessItem.modelData.cod + " · " + sessItem.modelData.titulo
                                        font.family: j.d.fonte
                                        font.pixelSize: Math.round(11 * j.s)
                                        font.weight: sessItem.ehProxima ? Font.DemiBold : Font.Normal
                                        font.strikeout: sessItem.modelData.done
                                        color: j.texto
                                        elide: Text.ElideRight
                                        maximumLineCount: 1
                                    }

                                    Text {
                                        text: sessItem.modelData.estudadoTexto + " / " + sessItem.modelData.duracaoTexto
                                        font.family: j.d.fonte
                                        font.features: ({ "tnum": 1 })
                                        font.pixelSize: Math.round(9.5 * j.s)
                                        color: j.textoFraco
                                    }
                                }

                                BarraProgresso {
                                    valor: sessItem.modelData.pct
                                    corBarra: sessItem.modelData.cor || Theme.primary
                                    alturaBarra: Math.max(2, Math.round(3 * j.s))
                                }
                            }

                            Zona {
                                icone: "play_arrow"
                                corIcone: sessItem.modelData.cor || Theme.primary
                                onClicked: j.d.iniciarPomodoroEm(sessItem.modelData.razaoPath, sessItem.modelData.cod + " Estudo " + j.d.semestre)
                            }

                            Zona {
                                icone: "add"
                                onClicked: j.abrirRegistroPara(sessItem.modelData.subjectId, sessItem.modelData.restanteMin, "teoria", "", "")
                            }
                        }

                        MouseArea {
                            id: sessMouse
                            anchors.fill: parent
                            anchors.rightMargin: Math.round(58 * j.s)
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                if (!sessItem.ehProxima && !sessItem.modelData.done)
                                    j.d.focarSessao(sessItem.modelData.id);
                                else
                                    j.d.abrirNota(sessItem.modelData.notaPath);
                            }
                        }
                    }
                }
            }

            // ═══════════════════════ ABA 2: PRAZOS & AVALIAÇÕES ═══════════════════════
            Flickable {
                anchors.fill: parent
                visible: j.d.abaAtual === "prazos"
                contentWidth: width
                contentHeight: colPrazos.implicitHeight
                clip: true
                boundsBehavior: Flickable.StopAtBounds

                ColumnLayout {
                    id: colPrazos
                    width: parent.width
                    spacing: Math.round(6 * j.s)

                    // Seção: Entregas e Tarefas Abertas
                    Text {
                        text: "ENTREGAS E TAREFAS ABERTAS (" + j.d.prazos.length + ")"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(9.5 * j.s)
                        font.weight: Font.Bold
                        color: j.textoFraco
                    }

                    Text {
                        visible: j.d.prazos.length === 0
                        text: "Nenhuma entrega pendente."
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(11 * j.s)
                        color: j.textoFraco
                    }

                    Repeater {
                        model: j.d.prazos
                        delegate: Item {
                            id: prazoItem
                            required property var modelData
                            Layout.fillWidth: true
                            Layout.preferredHeight: Math.round(36 * j.s)

                            Vidro {
                                anchors.fill: parent
                                raio: j.raioInterno
                                intensidade: prazoItem.modelData.atrasado ? 0.65 : 0.38
                                opacidadeGeral: j.opacidadeBotoes
                                realce: prazoMouse.containsMouse
                            }

                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: Math.round(6 * j.s)
                                anchors.rightMargin: Math.round(6 * j.s)
                                spacing: Math.round(6 * j.s)

                                Zona {
                                    icone: "check_circle"
                                    corIcone: prazoItem.modelData.atrasado ? j.corErro : j.corOk
                                    onClicked: j.d.concluirTarefa(prazoItem.modelData.path)
                                }

                                PontoCor {
                                    corPonto: prazoItem.modelData.cor || Theme.primary
                                }

                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 1

                                    Text {
                                        Layout.fillWidth: true
                                        text: prazoItem.modelData.title
                                        font.family: j.d.fonte
                                        font.pixelSize: Math.round(11 * j.s)
                                        font.weight: Font.Medium
                                        color: j.texto
                                        elide: Text.ElideRight
                                        maximumLineCount: 1
                                    }

                                    Text {
                                        text: prazoItem.modelData.cod + " · " + prazoItem.modelData.type + (prazoItem.modelData.dueCurto ? (" · " + prazoItem.modelData.dueCurto) : "")
                                        font.family: j.d.fonte
                                        font.pixelSize: Math.round(9 * j.s)
                                        color: j.textoFraco
                                    }
                                }

                                Text {
                                    text: prazoItem.modelData.quando
                                    font.family: j.d.fonte
                                    font.features: ({ "tnum": 1 })
                                    font.pixelSize: Math.round(10 * j.s)
                                    font.weight: Font.Bold
                                    color: prazoItem.modelData.atrasado
                                        ? j.corErro
                                        : (prazoItem.modelData.dias <= 2 ? j.corAviso : j.corOk)
                                }

                                Zona {
                                    icone: "play_arrow"
                                    corIcone: Theme.primary
                                    onClicked: j.d.iniciarPomodoroEm(prazoItem.modelData.path, prazoItem.modelData.title)
                                }
                            }

                            MouseArea {
                                id: prazoMouse
                                anchors.fill: parent
                                anchors.leftMargin: Math.round(32 * j.s)
                                anchors.rightMargin: Math.round(32 * j.s)
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: j.d.abrirNota(prazoItem.modelData.path)
                            }
                        }
                    }

                    // Seção: Próximas Avaliações
                    Text {
                        Layout.topMargin: Math.round(4 * j.s)
                        text: "CALENDÁRIO DE AVALIAÇÕES"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(9.5 * j.s)
                        font.weight: Font.Bold
                        color: j.textoFraco
                    }

                    Repeater {
                        model: j.d.avaliacoes
                        delegate: Item {
                            id: avalItem
                            required property var modelData
                            Layout.fillWidth: true
                            Layout.preferredHeight: Math.round(32 * j.s)
                            opacity: modelData.passou ? 0.48 : 1.0

                            Vidro {
                                anchors.fill: parent
                                raio: j.raioInterno
                                intensidade: 0.35
                                opacidadeGeral: j.opacidadeBotoes
                                realce: avalMouse.containsMouse
                            }

                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: Math.round(8 * j.s)
                                anchors.rightMargin: Math.round(8 * j.s)
                                spacing: Math.round(6 * j.s)

                                Text {
                                    text: avalItem.modelData.dataCurta
                                    font.family: j.d.fonte
                                    font.features: ({ "tnum": 1 })
                                    font.pixelSize: Math.round(10 * j.s)
                                    color: j.textoFraco
                                    Layout.preferredWidth: Math.round(34 * j.s)
                                }

                                PontoCor {
                                    corPonto: avalItem.modelData.cor || Theme.primary
                                }

                                Text {
                                    Layout.fillWidth: true
                                    text: avalItem.modelData.cod + " · " + avalItem.modelData.nome + (avalItem.modelData.peso ? (" (" + avalItem.modelData.peso + ")") : "")
                                    font.family: j.d.fonte
                                    font.pixelSize: Math.round(11 * j.s)
                                    font.weight: Font.Medium
                                    color: j.texto
                                    elide: Text.ElideRight
                                    maximumLineCount: 1
                                }

                                Text {
                                    text: avalItem.modelData.quando
                                    font.family: j.d.fonte
                                    font.features: ({ "tnum": 1 })
                                    font.pixelSize: Math.round(10 * j.s)
                                    font.weight: (!avalItem.modelData.passou && avalItem.modelData.dias <= 7) ? Font.Bold : Font.Normal
                                    color: (!avalItem.modelData.passou && avalItem.modelData.dias <= 7) ? j.corErro : j.textoFraco
                                }
                            }

                            MouseArea {
                                id: avalMouse
                                anchors.fill: parent
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: j.d.abrirNota(avalItem.modelData.path)
                            }
                        }
                    }
                }
            }

            // ═══════════════════════ ABA 3: REVISÕES, ANKI & HISTÓRICO ═══════════════════════
            Flickable {
                anchors.fill: parent
                visible: j.d.abaAtual === "revisoes"
                contentWidth: width
                contentHeight: colRevisoes.implicitHeight
                clip: true
                boundsBehavior: Flickable.StopAtBounds

                ColumnLayout {
                    id: colRevisoes
                    width: parent.width
                    spacing: Math.round(6 * j.s)

                    // Seção: Anki
                    RowLayout {
                        Layout.fillWidth: true
                        Text {
                            text: "ANKI (" + (j.res.ankiHoje || 0) + " PARA HOJE)"
                            font.family: j.d.fonte
                            font.pixelSize: Math.round(9.5 * j.s)
                            font.weight: Font.Bold
                            color: j.textoFraco
                            Layout.fillWidth: true
                        }

                        BotaoVidro {
                            opacidadeGeral: j.opacidadeBotoes
                            icone: "open_in_new"
                            texto: "Abrir Anki"
                            raio: j.raioInterno
                            altura: Math.round(20 * j.s)
                            tamanhoIcone: Math.round(12 * j.s)
                            tamanhoTexto: Math.round(9.5 * j.s)
                            folga: Math.round(6 * j.s)
                            onClicked: j.d.revisarAnki("")
                        }
                    }

                    Repeater {
                        model: j.d.anki
                        delegate: Item {
                            id: ankiItem
                            required property var modelData
                            Layout.fillWidth: true
                            Layout.preferredHeight: Math.round(32 * j.s)

                            Vidro {
                                anchors.fill: parent
                                raio: j.raioInterno
                                intensidade: 0.38
                                opacidadeGeral: j.opacidadeBotoes
                            }

                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: Math.round(8 * j.s)
                                anchors.rightMargin: Math.round(6 * j.s)
                                spacing: Math.round(6 * j.s)

                                PontoCor {
                                    corPonto: ankiItem.modelData.cor || Theme.primary
                                }

                                Text {
                                    text: ankiItem.modelData.cod
                                    font.family: j.d.fonte
                                    font.pixelSize: Math.round(11 * j.s)
                                    font.weight: Font.Bold
                                    color: j.texto
                                }

                                Text {
                                    Layout.fillWidth: true
                                    text: ankiItem.modelData.cards + " cards · " + ankiItem.modelData.novos + " novos"
                                    font.family: j.d.fonte
                                    font.pixelSize: Math.round(10 * j.s)
                                    color: j.textoFraco
                                    elide: Text.ElideRight
                                }

                                Text {
                                    text: ankiItem.modelData.paraHoje + " hoje"
                                    font.family: j.d.fonte
                                    font.features: ({ "tnum": 1 })
                                    font.pixelSize: Math.round(10.5 * j.s)
                                    font.weight: ankiItem.modelData.paraHoje > 0 ? Font.Bold : Font.Normal
                                    color: ankiItem.modelData.paraHoje > 0 ? j.corAviso : j.textoFraco
                                }

                                BotaoVidro {
                                    opacidadeGeral: j.opacidadeBotoes
                                    texto: "Revisar"
                                    raio: j.raioInterno
                                    destaque: ankiItem.modelData.paraHoje > 0
                                    altura: Math.round(22 * j.s)
                                    tamanhoTexto: Math.round(9.5 * j.s)
                                    folga: Math.round(6 * j.s)
                                    onClicked: j.d.revisarAnki(ankiItem.modelData.baralho)
                                }
                            }
                        }
                    }

                    // Seção: Revisões Agendadas
                    Text {
                        Layout.topMargin: Math.round(4 * j.s)
                        text: "REVISÕES PROGRAMADAS (" + j.d.revisoes.length + ")"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(9.5 * j.s)
                        font.weight: Font.Bold
                        color: j.textoFraco
                    }

                    Text {
                        visible: j.d.revisoes.length === 0
                        text: "Nenhuma revisão pendente."
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(11 * j.s)
                        color: j.textoFraco
                    }

                    Repeater {
                        model: j.d.revisoes
                        delegate: Item {
                            id: revItem
                            required property var modelData
                            Layout.fillWidth: true
                            Layout.preferredHeight: Math.round(34 * j.s)

                            Vidro {
                                anchors.fill: parent
                                raio: j.raioInterno
                                intensidade: revItem.modelData.hoje ? 0.55 : 0.35
                                opacidadeGeral: j.opacidadeBotoes
                            }

                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: Math.round(8 * j.s)
                                anchors.rightMargin: Math.round(6 * j.s)
                                spacing: Math.round(6 * j.s)

                                PontoCor {
                                    corPonto: revItem.modelData.cor || Theme.primary
                                }

                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 1

                                    Text {
                                        Layout.fillWidth: true
                                        text: revItem.modelData.cod + (revItem.modelData.topicoNome ? (" · " + revItem.modelData.topicoNome) : "")
                                        font.family: j.d.fonte
                                        font.pixelSize: Math.round(11 * j.s)
                                        font.weight: Font.Medium
                                        color: j.texto
                                        elide: Text.ElideRight
                                    }

                                    Text {
                                        text: "revisão de " + revItem.modelData.intervalo + "d · vence " + revItem.modelData.venceCurto
                                        font.family: j.d.fonte
                                        font.pixelSize: Math.round(9 * j.s)
                                        color: revItem.modelData.atrasada ? j.corErro : j.textoFraco
                                    }
                                }

                                Zona {
                                    icone: "add_task"
                                    corIcone: Theme.primary
                                    onClicked: j.abrirRegistroPara(revItem.modelData.subjectId, 25, "revisao", revItem.modelData.id, revItem.modelData.topicoId)
                                }

                                Zona {
                                    icone: "check"
                                    corIcone: j.corOk
                                    onClicked: j.d.statusRevisao(revItem.modelData.id, "feita")
                                }

                                Zona {
                                    icone: "close"
                                    corIcone: j.textoFraco
                                    onClicked: j.d.statusRevisao(revItem.modelData.id, "ignorada")
                                }
                            }
                        }
                    }

                    // Seção: Últimos Estudos & Sessões do Ink
                    Text {
                        Layout.topMargin: Math.round(4 * j.s)
                        text: "ÚLTIMOS ESTUDOS REGISTRADOS"
                        font.family: j.d.fonte
                        font.pixelSize: Math.round(9.5 * j.s)
                        font.weight: Font.Bold
                        color: j.textoFraco
                    }

                    Repeater {
                        model: j.d.historico.slice(0, 8)
                        delegate: Item {
                            id: histItem
                            required property var modelData
                            Layout.fillWidth: true
                            Layout.preferredHeight: Math.round(32 * j.s)

                            Vidro {
                                anchors.fill: parent
                                raio: j.raioInterno
                                intensidade: !histItem.modelData.confirmado ? 0.6 : 0.32
                                opacidadeGeral: j.opacidadeBotoes
                                realce: histMouse.containsMouse
                            }

                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: Math.round(8 * j.s)
                                anchors.rightMargin: Math.round(6 * j.s)
                                spacing: Math.round(6 * j.s)

                                Text {
                                    text: histItem.modelData.date.slice(8, 10) + "/" + histItem.modelData.date.slice(5, 7)
                                    font.family: j.d.fonte
                                    font.features: ({ "tnum": 1 })
                                    font.pixelSize: Math.round(9.5 * j.s)
                                    color: j.textoFraco
                                }

                                PontoCor {
                                    corPonto: histItem.modelData.cor || Theme.primary
                                }

                                Text {
                                    Layout.fillWidth: true
                                    text: histItem.modelData.cod + " · " + histItem.modelData.categoria
                                        + (histItem.modelData.topicoNome ? (" · " + histItem.modelData.topicoNome) : "")
                                        + (!histItem.modelData.confirmado ? " (Ink)" : "")
                                    font.family: j.d.fonte
                                    font.pixelSize: Math.round(10.5 * j.s)
                                    color: j.texto
                                    elide: Text.ElideRight
                                    maximumLineCount: 1
                                }

                                Text {
                                    text: histItem.modelData.duracaoTexto
                                    font.family: j.d.fonte
                                    font.features: ({ "tnum": 1 })
                                    font.pixelSize: Math.round(10 * j.s)
                                    font.weight: Font.Bold
                                    color: j.texto
                                }

                                Zona {
                                    visible: !histItem.modelData.confirmado
                                    icone: "check"
                                    corIcone: j.corOk
                                    onClicked: j.d.confirmarEstudo(histItem.modelData.path, histItem.modelData.id, true)
                                }

                                Zona {
                                    visible: !histItem.modelData.confirmado
                                    icone: "delete_outline"
                                    corIcone: j.corErro
                                    onClicked: j.d.confirmarEstudo(histItem.modelData.path, histItem.modelData.id, false)
                                }
                            }

                            MouseArea {
                                id: histMouse
                                anchors.fill: parent
                                anchors.rightMargin: !histItem.modelData.confirmado ? Math.round(54 * j.s) : 0
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: j.d.abrirNota(histItem.modelData.path)
                            }
                        }
                    }
                }
            }

            // ═══════════════════════ ABA 4: DISCIPLINAS DO SEMESTRE ═══════════════════════
            ListView {
                anchors.fill: parent
                visible: j.d.abaAtual === "disciplinas"
                clip: true
                spacing: Math.round(4 * j.s)
                boundsBehavior: Flickable.StopAtBounds
                model: j.d.disciplinas

                delegate: Item {
                    id: discItem
                    required property var modelData
                    width: ListView.view.width
                    height: Math.round(48 * j.s)

                    Vidro {
                        anchors.fill: parent
                        raio: j.raioInterno
                        intensidade: 0.42
                        opacidadeGeral: j.opacidadeBotoes
                        realce: discMouse.containsMouse
                    }

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: Math.round(8 * j.s)
                        anchors.rightMargin: Math.round(6 * j.s)
                        spacing: Math.round(7 * j.s)

                        PontoCor {
                            corPonto: discItem.modelData.cor || Theme.primary
                            tam: Math.round(9 * j.s)
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 3

                            RowLayout {
                                Layout.fillWidth: true
                                spacing: 5

                                Text {
                                    text: discItem.modelData.cod
                                    font.family: j.d.fonte
                                    font.pixelSize: Math.round(11 * j.s)
                                    font.weight: Font.Bold
                                    color: j.texto
                                }

                                Text {
                                    Layout.fillWidth: true
                                    text: discItem.modelData.titulo
                                    font.family: j.d.fonte
                                    font.pixelSize: Math.round(10.5 * j.s)
                                    color: j.textoFraco
                                    elide: Text.ElideRight
                                    maximumLineCount: 1
                                }

                                Rectangle {
                                    visible: discItem.modelData.atrasadas > 0
                                    radius: 4
                                    color: Qt.rgba(Theme.error.r, Theme.error.g, Theme.error.b, 0.22)
                                    implicitHeight: Math.round(15 * j.s)
                                    implicitWidth: atrTxt.implicitWidth + 8

                                    Text {
                                        id: atrTxt
                                        anchors.centerIn: parent
                                        text: discItem.modelData.atrasadas + " atr."
                                        font.family: j.d.fonte
                                        font.pixelSize: Math.round(8.5 * j.s)
                                        font.weight: Font.Bold
                                        color: j.corErro
                                    }
                                }

                                Text {
                                    text: discItem.modelData.tempoTotalTexto
                                    font.family: j.d.fonte
                                    font.features: ({ "tnum": 1 })
                                    font.pixelSize: Math.round(10 * j.s)
                                    font.weight: Font.Medium
                                    color: j.texto
                                }
                            }

                            RowLayout {
                                Layout.fillWidth: true
                                spacing: 6

                                BarraProgresso {
                                    valor: discItem.modelData.entregasPct
                                    corBarra: discItem.modelData.cor || Theme.primary
                                    alturaBarra: Math.max(3, Math.round(3.5 * j.s))
                                }

                                Text {
                                    text: "Entregas " + discItem.modelData.entregasFeitas + "/" + discItem.modelData.entregasTotal
                                    font.family: j.d.fonte
                                    font.features: ({ "tnum": 1 })
                                    font.pixelSize: Math.round(9 * j.s)
                                    color: j.textoFraco
                                }
                            }
                        }

                        Zona {
                            icone: "play_arrow"
                            corIcone: discItem.modelData.cor || Theme.primary
                            onClicked: j.d.iniciarPomodoroEm(discItem.modelData.razaoPath, discItem.modelData.cod + " Estudo " + j.d.semestre)
                        }

                        Zona {
                            icone: "add"
                            onClicked: j.abrirRegistroPara(discItem.modelData.id, 50, "teoria", "", "")
                        }
                    }

                    MouseArea {
                        id: discMouse
                        anchors.fill: parent
                        anchors.rightMargin: Math.round(58 * j.s)
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: j.d.abrirNota(discItem.modelData.path)
                    }
                }
            }
        }
    }

    // ───────────────────────────── Alça e Barra de Título Recolhível ─────────────────────────────

    Item {
        id: faixaTopo
        z: 3
        anchors {
            top: parent.top
            left: parent.left
            right: parent.right
        }
        height: Math.round(14 * j.s)

        HoverHandler {
            id: hoverFaixa
        }

        MouseArea {
            anchors.fill: parent
            enabled: !j.modoDesktopLayer
            onPressed: j.arrastar()
            onDoubleClicked: j.alternarMaximizar()
        }

        Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.top
            anchors.topMargin: Math.round(3 * j.s)
            width: Math.round(30 * j.s)
            height: Math.max(2, Math.round(3 * j.s))
            radius: height / 2
            color: j.texto
            opacity: barra.aberta ? 0 : (j.emFoco ? 0.45 : 0.18)
            Behavior on opacity { NumberAnimation { duration: 150 } }
        }
    }

    Item {
        id: barra
        z: 4
        visible: opacity > 0
        readonly property bool aberta: hoverFaixa.hovered || hoverBarra.hovered
        anchors {
            top: parent.top
            left: parent.left
            right: parent.right
        }
        height: j.margem + Math.round(26 * j.s)
        opacity: aberta ? 1 : 0
        Behavior on opacity { NumberAnimation { duration: 150 } }

        HoverHandler {
            id: hoverBarra
        }

        Rectangle {
            anchors.fill: parent
            topLeftRadius: j.canto
            topRightRadius: j.canto
            color: Qt.rgba(Theme.surfaceContainer.r, Theme.surfaceContainer.g, Theme.surfaceContainer.b, Math.max(0.88, j.opacidadeCartao))
        }

        MouseArea {
            anchors.fill: parent
            enabled: !j.modoDesktopLayer
            onPressed: j.arrastar()
            onDoubleClicked: j.alternarMaximizar()
        }

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: j.margem
            anchors.rightMargin: j.margem
            anchors.topMargin: Math.round(j.margem * 0.35)
            spacing: Math.round(6 * j.s)

            DankIcon {
                name: "school"
                size: Math.round(15 * j.s)
                color: Theme.primary
            }

            Text {
                text: "Acadêmico"
                font.family: j.d.fonte
                font.pixelSize: Math.round(12 * j.s)
                font.weight: Font.DemiBold
                color: j.texto
            }

            Rectangle {
                radius: j.raioInterno
                color: Qt.rgba(Theme.primary.r, Theme.primary.g, Theme.primary.b, 0.20)
                implicitHeight: Math.round(18 * j.s)
                implicitWidth: semBadge.implicitWidth + Math.round(10 * j.s)

                Text {
                    id: semBadge
                    anchors.centerIn: parent
                    text: j.d.semestre
                    font.family: j.d.fonte
                    font.pixelSize: Math.round(9.5 * j.s)
                    font.weight: Font.Bold
                    color: Theme.primary
                }
            }

            Item { Layout.fillWidth: true }

            BotaoVidro {
                opacidadeGeral: j.opacidadeBotoes
                icone: "dashboard"
                texto: "Painel"
                raio: j.raioInterno
                altura: Math.round(22 * j.s)
                tamanhoIcone: Math.round(13 * j.s)
                tamanhoTexto: Math.round(9.5 * j.s)
                folga: Math.round(6 * j.s)
                onClicked: j.d.abrirPainel()
            }

            BotaoVidro {
                opacidadeGeral: j.opacidadeBotoes
                icone: "refresh"
                raio: j.raioInterno
                altura: Math.round(22 * j.s)
                tamanhoIcone: Math.round(14 * j.s)
                onClicked: j.d.atualizar()
            }

            BotaoVidro {
                opacidadeGeral: j.opacidadeBotoes
                icone: "settings"
                raio: j.raioInterno
                altura: Math.round(22 * j.s)
                tamanhoIcone: Math.round(14 * j.s)
                onClicked: j.abrirConfig()
            }

            BotaoVidro {
                visible: !j.modoDesktopLayer
                opacidadeGeral: j.opacidadeBotoes
                icone: "close"
                raio: j.raioInterno
                altura: Math.round(22 * j.s)
                tamanhoIcone: Math.round(14 * j.s)
                onClicked: j.fechar()
            }
        }
    }
}
