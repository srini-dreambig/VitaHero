package kallam.healthcare.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import kallam.healthcare.ui.theme.Blue
import kallam.healthcare.ui.theme.Ink
import kallam.healthcare.ui.theme.Olive
import kallam.healthcare.ui.theme.OliveLight
import kallam.healthcare.ui.theme.Pink
import kallam.healthcare.ui.theme.PinkLight
import kallam.healthcare.ui.theme.Yellow
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/*
 * The app's illustrations: flat organic shapes in the palette (a flower, a
 * burst, a squiggle, a bolt, a smiley), arranged into a few scenes. They are
 * drawn, not bundled, so they stay sharp at any size and follow the palette.
 * ios/VitaHero/Support/Illustrations.swift and the console's SVGs draw the
 * same shapes with the same proportions.
 */

/** Which picture to draw. One per onboarding page, plus scenes for banners and empty and done states. */
enum class Scene { Growth, Checkup, Food, Doctor, Banner, Empty, Done }

@Composable
fun Illustration(scene: Scene, modifier: Modifier = Modifier) {
    Box(modifier) {
        Canvas(Modifier.fillMaxSize()) {
            val u = size.minDimension
            fun at(x: Float, y: Float) = Offset(size.width * x, size.height * y)
            when (scene) {
                Scene.Growth -> {
                    blob(at(0.5f, 0.55f), u * 0.42f, OliveLight)
                    flower(at(0.36f, 0.42f), u * 0.20f, Pink, Yellow)
                    burst(at(0.70f, 0.30f), u * 0.13f, Yellow)
                    squiggle(at(0.22f, 0.80f), u * 0.30f, Olive, u * 0.025f)
                    sparkle(at(0.78f, 0.72f), u * 0.07f, Ink)
                }
                Scene.Checkup -> {
                    blob(at(0.5f, 0.5f), u * 0.42f, PinkLight)
                    smiley(at(0.48f, 0.50f), u * 0.20f, Yellow)
                    bolt(at(0.78f, 0.30f), u * 0.15f, Blue)
                    burst(at(0.22f, 0.26f), u * 0.10f, Pink)
                    squiggle(at(0.55f, 0.85f), u * 0.30f, Ink, u * 0.02f)
                }
                Scene.Food -> {
                    blob(at(0.5f, 0.52f), u * 0.42f, Color(0xFFFEEFBF))
                    flower(at(0.62f, 0.40f), u * 0.18f, Olive, Yellow)
                    flower(at(0.34f, 0.62f), u * 0.13f, Pink, Ink)
                    sparkle(at(0.24f, 0.28f), u * 0.07f, Ink)
                    squiggle(at(0.60f, 0.84f), u * 0.26f, Pink, u * 0.025f)
                }
                Scene.Doctor -> {
                    blob(at(0.5f, 0.5f), u * 0.42f, Color(0xFFEAF0F9))
                    burst(at(0.50f, 0.48f), u * 0.20f, Blue)
                    smiley(at(0.50f, 0.48f), u * 0.10f, Yellow)
                    flower(at(0.20f, 0.74f), u * 0.10f, Pink, Yellow)
                    bolt(at(0.80f, 0.24f), u * 0.12f, Olive)
                }
                Scene.Banner -> {
                    flower(at(0.62f, 0.40f), u * 0.30f, Pink, Yellow)
                    sparkle(at(0.22f, 0.72f), u * 0.14f, Ink)
                }
                Scene.Empty -> {
                    blob(at(0.5f, 0.5f), u * 0.42f, Color(0xFFEFE8D7))
                    burst(at(0.5f, 0.5f), u * 0.18f, Yellow)
                    squiggle(at(0.5f, 0.82f), u * 0.26f, Olive, u * 0.025f)
                }
                Scene.Done -> {
                    burst(at(0.5f, 0.5f), u * 0.40f, Yellow)
                    smiley(at(0.5f, 0.5f), u * 0.20f, Pink)
                }
            }
        }
    }
}

/** A soft, slightly uneven round shape: the backdrop of a scene. */
private fun DrawScope.blob(c: Offset, r: Float, color: Color) {
    val wobble = floatArrayOf(1.00f, 0.93f, 1.05f, 0.97f, 1.04f, 0.92f, 1.02f, 0.96f)
    val n = wobble.size
    val pts = List(n) { i ->
        val a = 2 * PI * i / n - PI / 2
        Offset(c.x + (r * wobble[i] * cos(a)).toFloat(), c.y + (r * wobble[i] * sin(a)).toFloat())
    }
    val path = Path()
    for (i in 0 until n) {
        val p0 = pts[i]; val p1 = pts[(i + 1) % n]
        val mid = Offset((p0.x + p1.x) / 2, (p0.y + p1.y) / 2)
        if (i == 0) path.moveTo((pts[n - 1].x + p0.x) / 2, (pts[n - 1].y + p0.y) / 2)
        path.quadraticTo(p0.x, p0.y, mid.x, mid.y)
    }
    path.close()
    drawPath(path, color)
}

/** Six round petals around a centre. */
private fun DrawScope.flower(c: Offset, r: Float, petal: Color, centre: Color) {
    val petals = 6
    val pr = r * 0.42f
    for (i in 0 until petals) {
        val a = 2 * PI * i / petals
        drawCircle(petal, pr, Offset(c.x + (r * 0.58f * cos(a)).toFloat(), c.y + (r * 0.58f * sin(a)).toFloat()))
    }
    drawCircle(centre, r * 0.36f, c)
}

/** A star of rounded arms, like a hand-cut asterisk. */
private fun DrawScope.burst(c: Offset, r: Float, color: Color) {
    val arms = 8
    for (i in 0 until arms) {
        rotate(360f / arms * i, c) {
            drawLine(color, Offset(c.x, c.y - r), Offset(c.x, c.y + r), strokeWidth = r * 0.42f, cap = StrokeCap.Round)
        }
    }
}

/** A loose hand-drawn wave. */
private fun DrawScope.squiggle(c: Offset, width: Float, color: Color, stroke: Float) {
    val path = Path()
    val waves = 3
    val step = width / (waves * 2)
    val amp = width * 0.12f
    var x = c.x - width / 2
    path.moveTo(x, c.y)
    for (i in 0 until waves * 2) {
        val dir = if (i % 2 == 0) -1 else 1
        path.quadraticTo(x + step / 2, c.y + dir * amp, x + step, c.y)
        x += step
    }
    drawPath(path, color, style = Stroke(width = stroke, cap = StrokeCap.Round))
}

/** A chunky lightning bolt. */
private fun DrawScope.bolt(c: Offset, h: Float, color: Color) {
    val w = h * 0.62f
    val p = Path().apply {
        moveTo(c.x + w * 0.10f, c.y - h / 2)
        lineTo(c.x - w / 2, c.y + h * 0.08f)
        lineTo(c.x - w * 0.02f, c.y + h * 0.08f)
        lineTo(c.x - w * 0.14f, c.y + h / 2)
        lineTo(c.x + w / 2, c.y - h * 0.10f)
        lineTo(c.x + w * 0.02f, c.y - h * 0.10f)
        close()
    }
    drawPath(p, color)
}

/** A four-point sparkle. */
private fun DrawScope.sparkle(c: Offset, r: Float, color: Color) {
    val k = r * 0.18f
    val p = Path().apply {
        moveTo(c.x, c.y - r)
        quadraticTo(c.x + k, c.y - k, c.x + r, c.y)
        quadraticTo(c.x + k, c.y + k, c.x, c.y + r)
        quadraticTo(c.x - k, c.y + k, c.x - r, c.y)
        quadraticTo(c.x - k, c.y - k, c.x, c.y - r)
        close()
    }
    drawPath(p, color)
}

/** A round face: two eyes and a smile in ink. */
private fun DrawScope.smiley(c: Offset, r: Float, color: Color) {
    drawCircle(color, r, c)
    drawCircle(Ink, r * 0.10f, Offset(c.x - r * 0.34f, c.y - r * 0.18f))
    drawCircle(Ink, r * 0.10f, Offset(c.x + r * 0.34f, c.y - r * 0.18f))
    drawArc(
        Ink, startAngle = 20f, sweepAngle = 140f, useCenter = false,
        topLeft = Offset(c.x - r * 0.45f, c.y - r * 0.25f), size = Size(r * 0.9f, r * 0.8f),
        style = Stroke(width = r * 0.11f, cap = StrokeCap.Round),
    )
}
