import SwiftUI

/*
 * The app's illustrations: flat organic shapes in the palette (a flower, a
 * burst, a squiggle, a bolt, a smiley), arranged into a few scenes. They are
 * drawn, not bundled, so they stay sharp at any size and follow the palette.
 * The Android app's ui/components/Illustrations.kt draws the same shapes with
 * the same proportions.
 */

/// Which picture to draw.
enum ArtScene {
    case growth, checkup, food, doctor, banner, empty, done
}

struct Illustration: View {
    let scene: ArtScene

    var body: some View {
        Canvas { ctx, size in
            let u = min(size.width, size.height)
            func at(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: size.width * x, y: size.height * y) }
            switch scene {
            case .growth:
                blob(ctx, at(0.5, 0.55), u * 0.42, Brand.oliveLight)
                flower(ctx, at(0.36, 0.42), u * 0.20, Brand.pink, Brand.yellow)
                burst(ctx, at(0.70, 0.30), u * 0.13, Brand.yellow)
                squiggle(ctx, at(0.22, 0.80), u * 0.30, Brand.olive, u * 0.025)
                sparkle(ctx, at(0.78, 0.72), u * 0.07, Brand.ink)
            case .checkup:
                blob(ctx, at(0.5, 0.5), u * 0.42, Brand.pinkLight)
                smiley(ctx, at(0.48, 0.50), u * 0.20, Brand.yellow)
                bolt(ctx, at(0.78, 0.30), u * 0.15, Brand.sky)
                burst(ctx, at(0.22, 0.26), u * 0.10, Brand.pink)
                squiggle(ctx, at(0.55, 0.85), u * 0.30, Brand.ink, u * 0.02)
            case .food:
                blob(ctx, at(0.5, 0.52), u * 0.42, Brand.yellowLight)
                flower(ctx, at(0.62, 0.40), u * 0.18, Brand.olive, Brand.yellow)
                flower(ctx, at(0.34, 0.62), u * 0.13, Brand.pink, Brand.ink)
                sparkle(ctx, at(0.24, 0.28), u * 0.07, Brand.ink)
                squiggle(ctx, at(0.60, 0.84), u * 0.26, Brand.pink, u * 0.025)
            case .doctor:
                blob(ctx, at(0.5, 0.5), u * 0.42, Brand.skyLight)
                burst(ctx, at(0.50, 0.48), u * 0.20, Brand.sky)
                smiley(ctx, at(0.50, 0.48), u * 0.10, Brand.yellow)
                flower(ctx, at(0.20, 0.74), u * 0.10, Brand.pink, Brand.yellow)
                bolt(ctx, at(0.80, 0.24), u * 0.12, Brand.olive)
            case .banner:
                flower(ctx, at(0.62, 0.40), u * 0.30, Brand.pink, Brand.yellow)
                sparkle(ctx, at(0.22, 0.72), u * 0.14, Brand.ink)
            case .empty:
                blob(ctx, at(0.5, 0.5), u * 0.42, Brand.beigeDeep)
                burst(ctx, at(0.5, 0.5), u * 0.18, Brand.yellow)
                squiggle(ctx, at(0.5, 0.82), u * 0.26, Brand.olive, u * 0.025)
            case .done:
                burst(ctx, at(0.5, 0.5), u * 0.40, Brand.yellow)
                smiley(ctx, at(0.5, 0.5), u * 0.20, Brand.pink)
            }
        }
        .accessibilityHidden(true)
    }
}

private func pt(_ c: CGPoint, _ r: CGFloat, _ a: CGFloat) -> CGPoint {
    CGPoint(x: c.x + r * cos(a), y: c.y + r * sin(a))
}

/// A soft, slightly uneven round shape: the backdrop of a scene.
private func blob(_ ctx: GraphicsContext, _ c: CGPoint, _ r: CGFloat, _ color: Color) {
    let wobble: [CGFloat] = [1.00, 0.93, 1.05, 0.97, 1.04, 0.92, 1.02, 0.96]
    let n = wobble.count
    let pts = (0..<n).map { i in pt(c, r * wobble[i], 2 * .pi * CGFloat(i) / CGFloat(n) - .pi / 2) }
    var path = Path()
    for i in 0..<n {
        let p0 = pts[i], p1 = pts[(i + 1) % n]
        let mid = CGPoint(x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2)
        if i == 0 {
            let last = pts[n - 1]
            path.move(to: CGPoint(x: (last.x + p0.x) / 2, y: (last.y + p0.y) / 2))
        }
        path.addQuadCurve(to: mid, control: p0)
    }
    path.closeSubpath()
    ctx.fill(path, with: .color(color))
}

private func circle(_ ctx: GraphicsContext, _ c: CGPoint, _ r: CGFloat, _ color: Color) {
    ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)), with: .color(color))
}

/// Six round petals around a centre.
private func flower(_ ctx: GraphicsContext, _ c: CGPoint, _ r: CGFloat, _ petal: Color, _ centre: Color) {
    for i in 0..<6 {
        circle(ctx, pt(c, r * 0.58, 2 * .pi * CGFloat(i) / 6), r * 0.42, petal)
    }
    circle(ctx, c, r * 0.36, centre)
}

/// A star of rounded arms, like a hand-cut asterisk.
private func burst(_ ctx: GraphicsContext, _ c: CGPoint, _ r: CGFloat, _ color: Color) {
    for i in 0..<8 {
        let a = .pi / 4 * CGFloat(i)
        var p = Path()
        p.move(to: pt(c, r, a - .pi / 2))
        p.addLine(to: pt(c, r, a + .pi / 2))
        ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: r * 0.42, lineCap: .round))
    }
}

/// A loose hand-drawn wave.
private func squiggle(_ ctx: GraphicsContext, _ c: CGPoint, _ width: CGFloat, _ color: Color, _ stroke: CGFloat) {
    let waves = 3
    let step = width / CGFloat(waves * 2)
    let amp = width * 0.12
    var x = c.x - width / 2
    var p = Path()
    p.move(to: CGPoint(x: x, y: c.y))
    for i in 0..<(waves * 2) {
        let dir: CGFloat = i % 2 == 0 ? -1 : 1
        p.addQuadCurve(to: CGPoint(x: x + step, y: c.y), control: CGPoint(x: x + step / 2, y: c.y + dir * amp))
        x += step
    }
    ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: stroke, lineCap: .round))
}

/// A chunky lightning bolt.
private func bolt(_ ctx: GraphicsContext, _ c: CGPoint, _ h: CGFloat, _ color: Color) {
    let w = h * 0.62
    var p = Path()
    p.move(to: CGPoint(x: c.x + w * 0.10, y: c.y - h / 2))
    p.addLine(to: CGPoint(x: c.x - w / 2, y: c.y + h * 0.08))
    p.addLine(to: CGPoint(x: c.x - w * 0.02, y: c.y + h * 0.08))
    p.addLine(to: CGPoint(x: c.x - w * 0.14, y: c.y + h / 2))
    p.addLine(to: CGPoint(x: c.x + w / 2, y: c.y - h * 0.10))
    p.addLine(to: CGPoint(x: c.x + w * 0.02, y: c.y - h * 0.10))
    p.closeSubpath()
    ctx.fill(p, with: .color(color))
}

/// A four-point sparkle.
private func sparkle(_ ctx: GraphicsContext, _ c: CGPoint, _ r: CGFloat, _ color: Color) {
    let k = r * 0.18
    var p = Path()
    p.move(to: CGPoint(x: c.x, y: c.y - r))
    p.addQuadCurve(to: CGPoint(x: c.x + r, y: c.y), control: CGPoint(x: c.x + k, y: c.y - k))
    p.addQuadCurve(to: CGPoint(x: c.x, y: c.y + r), control: CGPoint(x: c.x + k, y: c.y + k))
    p.addQuadCurve(to: CGPoint(x: c.x - r, y: c.y), control: CGPoint(x: c.x - k, y: c.y + k))
    p.addQuadCurve(to: CGPoint(x: c.x, y: c.y - r), control: CGPoint(x: c.x - k, y: c.y - k))
    p.closeSubpath()
    ctx.fill(p, with: .color(color))
}

/// A round face: two eyes and a smile in ink.
private func smiley(_ ctx: GraphicsContext, _ c: CGPoint, _ r: CGFloat, _ color: Color) {
    circle(ctx, c, r, color)
    circle(ctx, CGPoint(x: c.x - r * 0.34, y: c.y - r * 0.18), r * 0.10, Brand.ink)
    circle(ctx, CGPoint(x: c.x + r * 0.34, y: c.y - r * 0.18), r * 0.10, Brand.ink)
    var smile = Path()
    smile.addArc(center: CGPoint(x: c.x, y: c.y + r * 0.15), radius: r * 0.42,
                 startAngle: .degrees(20), endAngle: .degrees(160), clockwise: false)
    ctx.stroke(smile, with: .color(Brand.ink), style: StrokeStyle(lineWidth: r * 0.11, lineCap: .round))
}
