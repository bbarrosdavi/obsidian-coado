import QtQuick

// Vidro de controle: placa clara quase transparente e um fio de luz fino no topo (mais
// forte) e na base, sumindo nas laterais. raio < 0 dá a forma redonda.
Item {
    id: v

    property real raio: -1
    property color tinta: "transparent"
    property bool temTinta: false
    property bool apertado: false
    property bool realce: false
    property real intensidade: 1
    property real opacidadeGeral: 1

    readonly property real r: {
        const meio = Math.min(width, height) / 2;
        return raio < 0 ? meio : Math.min(raio, meio);
    }

    property real luz: apertado ? 1 : (realce ? 0.5 : 0)
    Behavior on luz {
        NumberAnimation { duration: 120; easing.type: Easing.OutCubic }
    }

    Rectangle {
        anchors.fill: parent
        radius: v.r
        color: v.temTinta
            ? Qt.rgba(v.tinta.r, v.tinta.g, v.tinta.b, 0.78 + 0.12 * v.luz)
            : Qt.rgba(1, 1, 1, (0.05 + 0.06 * v.luz) * v.intensidade * v.opacidadeGeral)
    }

    Canvas {
        id: fio
        anchors.fill: parent
        opacity: Math.min(1, v.opacidadeGeral)
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()

        Connections {
            target: v
            function onRChanged() {
                fio.requestPaint();
            }
        }

        onPaint: {
            const ctx = getContext("2d");
            ctx.reset();
            const k = 0.5;
            const rr = Math.max(0, v.r - k);
            const g = ctx.createLinearGradient(0, 0, 0, height);
            g.addColorStop(0, Qt.rgba(1, 1, 1, 0.30));
            g.addColorStop(0.2, Qt.rgba(1, 1, 1, 0));
            g.addColorStop(0.8, Qt.rgba(1, 1, 1, 0));
            g.addColorStop(1, Qt.rgba(1, 1, 1, 0.10));
            ctx.strokeStyle = g;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundedRect(k, k, width - 2 * k, height - 2 * k, rr, rr);
            ctx.stroke();
        }
    }
}
