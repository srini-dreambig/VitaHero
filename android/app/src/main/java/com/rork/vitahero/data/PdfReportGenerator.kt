package com.rork.vitahero.data

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDate
import java.time.format.DateTimeFormatter

data class ReportData(
    val kid: Kid,
    val meals: List<MealItem>,
    val streak: StreakInfo,
    val badges: List<Badge>,
    val generatedDate: String = LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"))
)

object PdfReportGenerator {

    private const val PAGE_WIDTH = 595
    private const val PAGE_HEIGHT = 842
    private const val MARGIN = 40
    private const val CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

    fun generate(context: Context, data: ReportData): File {
        val document = PdfDocument()
        val page = document.startPage(
            PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, 1).create()
        )
        val canvas = page.canvas

        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT_BOLD; it.textSize = 24f; it.color = 0xFF10B981.toInt()
        }
        val subtitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT_BOLD; it.textSize = 16f; it.color = 0xFF0F172A.toInt()
        }
        val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT; it.textSize = 12f; it.color = 0xFF475569.toInt()
        }
        val headerPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT_BOLD; it.textSize = 13f; it.color = 0xFF0F172A.toInt()
        }
        val greenPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT_BOLD; it.textSize = 12f; it.color = 0xFF10B981.toInt()
        }
        val alertPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT_BOLD; it.textSize = 12f; it.color = 0xFFEF4444.toInt()
        }
        val warnPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT_BOLD; it.textSize = 12f; it.color = 0xFFF59E0B.toInt()
        }
        val mutedPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT_BOLD; it.textSize = 12f; it.color = 0xFF94A3B8.toInt()
        }
        val linePaint = Paint().also { it.color = 0xFFE6EEEA.toInt(); it.strokeWidth = 1f }
        val bgPaint = Paint().also { it.color = 0xFFF6FBF9.toInt(); it.style = Paint.Style.FILL }
        val headerBgPaint = Paint().also { it.color = 0xFF10B981.toInt() }
        val headerTitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT_BOLD; it.textSize = 28f; it.color = 0xFFFFFFFF.toInt()
        }
        val headerSubPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT; it.textSize = 14f; it.color = 0xD9FFFFFF.toInt()
        }
        val faintPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT; it.textSize = 10f; it.color = 0xFF94A3B8.toInt()
        }
        val smallLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT; it.textSize = 10f; it.color = 0xFF94A3B8.toInt()
        }
        val smallValuePaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT_BOLD; it.textSize = 16f; it.color = 0xFF0F172A.toInt()
        }
        val disclaimerPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT; it.textSize = 9f; it.color = 0xFF94A3B8.toInt()
        }

        var y = MARGIN.toFloat()

        // Header
        canvas.drawRect(0f, 0f, PAGE_WIDTH.toFloat(), 100f, headerBgPaint)
        canvas.drawText("VitaHero", MARGIN.toFloat(), 50f, headerTitlePaint)
        canvas.drawText("Child Health Report", MARGIN.toFloat(), 78f, headerSubPaint)
        y = 120f

        val k = data.kid

        // Kid info section
        canvas.drawText(k.name.uppercase(), MARGIN.toFloat(), y, titlePaint)
        y += 30f
        canvas.drawText("${k.age} yrs \u00B7 ${k.gender} \u00B7 ${k.school} \u00B7 ${k.grade}", MARGIN.toFloat(), y, bodyPaint)
        y += 24f
        canvas.drawText("Report generated: ${data.generatedDate}", MARGIN.toFloat(), y, faintPaint)
        y += 36f

        // Vital stats card
        canvas.drawRoundRect(MARGIN.toFloat(), y, PAGE_WIDTH - MARGIN.toFloat(), y + 80f, 12f, 12f, bgPaint)
        y += 20f
        canvas.drawText("VITAL STATISTICS", MARGIN + 16f, y, headerPaint)
        y += 22f
        val stats = listOf(
            "Height" to k.heightText(),
            "Weight" to k.weightText(),
            "Health Score" to "${k.overallScore}%"
        )
        var sx = MARGIN + 16f
        stats.forEach { (label, value) ->
            canvas.drawText(label, sx, y, smallLabelPaint)
            canvas.drawText(value, sx, y + 14f, smallValuePaint)
            sx += (CONTENT_WIDTH - 32f) / 3
        }
        y += 100f

        // Growth section
        canvas.drawText("GROWTH TRACKING", MARGIN.toFloat(), y, subtitlePaint)
        y += 24f
        drawGrowthChart(canvas, MARGIN.toFloat(), y, CONTENT_WIDTH.toFloat(), 120f, k.growth, false, 0xFF10B981.toInt())
        y += 130f
        drawGrowthChart(canvas, MARGIN.toFloat(), y, CONTENT_WIDTH.toFloat(), 120f, k.growth, true, 0xFF2563EB.toInt())
        y += 140f

        // Health flags
        canvas.drawText("HEALTH STATUS", MARGIN.toFloat(), y, subtitlePaint)
        y += 24f
        val flags = listOf(
            Triple("Dental", k.dental.label, k.dental),
            Triple("Eyesight", k.eyesight.label, k.eyesight),
            Triple("Nutrition", k.nutrition.label, k.nutrition)
        )
        flags.forEach { (name, label, flag) ->
            val fp = when (flag) {
                HealthFlag.GOOD -> greenPaint
                HealthFlag.ALERT -> alertPaint
                HealthFlag.WATCH -> warnPaint
                HealthFlag.NOT_MEASURED -> mutedPaint
            }
            canvas.drawText("$name: $label", MARGIN + 4f, y, fp)
            y += 20f
        }
        y += 10f

        // Badges
        canvas.drawText("EARNED BADGES", MARGIN.toFloat(), y, subtitlePaint)
        y += 24f
        val earned = data.badges.filter { it.earned }
        if (earned.isNotEmpty()) {
            earned.forEach { badge ->
                canvas.drawText("\u2022 ${badge.title} \u2014 ${badge.description}", MARGIN + 4f, y, bodyPaint)
                y += 18f
            }
        } else {
            canvas.drawText("No badges earned yet. Keep tracking meals!", MARGIN + 4f, y, bodyPaint)
            y += 18f
        }
        y += 10f

        // Diet summary
        canvas.drawText("DIET SUMMARY", MARGIN.toFloat(), y, subtitlePaint)
        y += 24f
        val eaten = data.meals.count { it.eaten }
        val totalKcal = data.meals.filter { it.eaten }.sumOf { it.kcal }
        canvas.drawText("Meals logged: $eaten / ${data.meals.size}", MARGIN + 4f, y, bodyPaint)
        y += 18f
        canvas.drawText("Calories consumed: $totalKcal kcal", MARGIN + 4f, y, bodyPaint)
        y += 18f
        canvas.drawText("Current streak: ${data.streak.currentStreak} days (Best: ${data.streak.bestStreak})", MARGIN + 4f, y, bodyPaint)
        y += 30f

        // Disclaimer
        canvas.drawLine(MARGIN.toFloat(), y, PAGE_WIDTH - MARGIN.toFloat(), y, linePaint)
        y += 16f
        canvas.drawText(
            "Disclaimer: This report is for informational purposes only. Always consult a qualified doctor for medical diagnosis and treatment.",
            MARGIN.toFloat(), y, disclaimerPaint
        )

        document.finishPage(page)

        val dir = File(context.cacheDir, "reports")
        if (!dir.exists()) dir.mkdirs()
        val file = File(dir, "VitaHero_${k.name}_${LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE)}.pdf")
        FileOutputStream(file).use { document.writeTo(it) }
        document.close()
        return file
    }

    private fun drawGrowthChart(
        canvas: Canvas,
        cX: Float, cY: Float, cW: Float, cH: Float,
        points: List<GrowthPoint>,
        isWeight: Boolean,
        lineColor: Int
    ) {
        if (points.size < 2) return
        val values = points.map { if (isWeight) it.weight else it.height }
        val minV = values.min()
        val maxV = values.max()
        val range = (maxV - minV).coerceAtLeast(1f)
        val pad = 24f
        val chartW = cW - pad * 2
        val chartH = cH - pad * 2
        val stepX = chartW / (points.size - 1)

        val label = if (isWeight) "Weight (kg)" else "Height (cm)"
        val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT_BOLD; it.textSize = 11f; it.color = lineColor
        }
        canvas.drawText(label, cX, cY - 6f, labelPaint)

        val gridPaint = Paint().also { it.color = 0x1A000000; it.strokeWidth = 1f }
        val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.color = lineColor; it.strokeWidth = 4f; it.style = Paint.Style.STROKE; it.strokeCap = Paint.Cap.ROUND
        }
        val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.color = 0xFFFFFFFF.toInt(); it.style = Paint.Style.FILL
        }
        val dotBorder = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.color = lineColor; it.strokeWidth = 3f; it.style = Paint.Style.STROKE
        }
        val valPaint = Paint(Paint.ANTI_ALIAS_FLAG).also {
            it.typeface = Typeface.DEFAULT; it.textSize = 9f; it.color = 0xFF0F172A.toInt()
        }

        for (i in 0..3) {
            val gy = cY + pad + chartH * i / 3
            canvas.drawLine(cX + pad, gy, cX + pad + chartW, gy, gridPaint)
        }

        for (i in 0 until points.size - 1) {
            val x1 = cX + pad + stepX * i
            val y1 = cY + pad + chartH - chartH * (values[i] - minV) / range
            val x2 = cX + pad + stepX * (i + 1)
            val y2 = cY + pad + chartH - chartH * (values[i + 1] - minV) / range
            canvas.drawLine(x1, y1, x2, y2, linePaint)
        }

        points.forEachIndexed { i, pt ->
            val cx = cX + pad + stepX * i
            val cy = cY + pad + chartH - chartH * (values[i] - minV) / range
            canvas.drawCircle(cx, cy, 5f, dotPaint)
            canvas.drawCircle(cx, cy, 5f, dotBorder)
            canvas.drawText(
                if (isWeight) "${pt.weight}kg" else "${pt.height}cm",
                cx - 14f, cy - 10f, valPaint
            )
        }
    }

    fun shareReport(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "VitaHero Health Report - ${file.nameWithoutExtension}")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share Health Report"))
    }
}
