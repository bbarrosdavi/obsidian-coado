import QtQuick
import qs.Common
import qs.Widgets

// Botão de vidro com mola ao apertar. Com texto vira botão de rótulo; só com ícone,
// raio < 0 o deixa redondo.
Item {
    id: b

    property string icone: ""
    property string texto: ""
    property real raio: -1
    property bool destaque: false
    property color corDestaque: Theme.primary
    property color corConteudo: destaque ? Theme.onPrimary : Theme.surfaceText
    property real altura: 28
    property real tamanhoIcone: 16
    property real tamanhoTexto: 11
    property real folga: 10
    property string fonte: "Noto Sans"
    property real opacidadeGeral: 1

    signal clicked

    implicitHeight: altura
    implicitWidth: texto !== "" ? linha.implicitWidth + folga * 2 : altura

    scale: area.pressed ? 0.975 : 1
    Behavior on scale {
        SpringAnimation { spring: 6; damping: 0.35; epsilon: 0.001 }
    }

    Vidro {
        anchors.fill: parent
        opacidadeGeral: b.opacidadeGeral
        raio: b.raio
        temTinta: b.destaque
        tinta: b.corDestaque
        apertado: area.pressed
        realce: area.containsMouse
    }

    Row {
        id: linha
        anchors.centerIn: parent
        spacing: Math.round(b.tamanhoTexto * 0.45)

        DankIcon {
            visible: b.icone !== ""
            name: b.icone
            size: b.tamanhoIcone
            color: b.corConteudo
            anchors.verticalCenter: parent.verticalCenter
        }

        Text {
            visible: b.texto !== ""
            text: b.texto
            font.family: b.fonte
            font.pixelSize: b.tamanhoTexto
            font.weight: Font.Bold
            color: b.corConteudo
            anchors.verticalCenter: parent.verticalCenter
        }
    }

    MouseArea {
        id: area
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: b.clicked()
    }
}
