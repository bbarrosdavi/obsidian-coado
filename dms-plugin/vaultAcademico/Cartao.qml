import QtQuick

// Fundo da janela com linha de borda e cantos arredondados.
Item {
    id: c

    property var cantos: [14, 14, 14, 14]
    property color cor: "transparent"
    property color corBorda: "transparent"

    Rectangle {
        anchors.fill: parent
        topLeftRadius: c.cantos[0]
        topRightRadius: c.cantos[1]
        bottomRightRadius: c.cantos[2]
        bottomLeftRadius: c.cantos[3]
        color: c.cor
        border.width: 1
        border.color: c.corBorda
    }
}
