package com.rork.vitahero.data

import com.rork.vitahero.BuildConfig
import io.ktor.client.call.body
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * AI Diet Coach — calls the Rork AI proxy (Vercel AI Gateway) via
 * the Toolkit URL to generate personalised paediatric diet tips.
 *
 * Uses openai/gpt-4.1-nano — cost-effective, fast, supports reasoning.
 */
object AIService {

    private val toolkitUrl: String get() = BuildConfig.TOOLKIT_URL
    private val toolkitKey: String get() = BuildConfig.TOOLKIT_SECRET_KEY

    private const val MODEL = "openai/gpt-4.1-nano"

    /**
     * Generate a personalised diet coaching tip for a kid.
     */
    suspend fun generateDietTip(
        kid: Kid,
        meals: List<MealItem>,
        streak: StreakInfo
    ): AIDietContent = withContext(Dispatchers.IO) {
        val eatenCount = meals.count { it.eaten }
        val totalKcal = meals.filter { it.eaten }.sumOf { it.kcal }
        val mealNames = meals.joinToString(", ") { "${it.name} (${it.kcal} kcal)" }

        val systemPrompt = buildString {
            appendLine("You are a pediatric nutrition coach for VitaHero, an Indian child health app.")
            appendLine("Give culturally relevant, actionable diet tips for Indian parents.")
            appendLine("Focus on Indian foods: dal, roti, rice, sabzi, idli, dosa, poha, paneer, ragi, curd, sprouts.")
            appendLine("Respond ONLY with a valid JSON: {\"greeting\":\"...\", \"insight\":\"...\", \"suggestion\":\"...\", \"funFact\":\"...\"}")
            appendLine("Keep each field 1-2 sentences max. No markdown, no extra text.")
        }

        val userPrompt = buildString {
            appendLine("Child: ${kid.name}, ${kid.age} years, ${kid.gender}")
            appendLine("BMI: %.1f, Health Score: ${kid.overallScore}/100".format(kid.bmi))
            appendLine("Dental: ${kid.dental.name}, Nutrition: ${kid.nutrition.name}")
            appendLine("Meals ($eatenCount/${meals.size} eaten, $totalKcal kcal): $mealNames")
            appendLine("Streak: ${streak.currentStreak} days (best ${streak.bestStreak})")
            if (kid.nutrition == HealthFlag.WATCH) appendLine("Nutrition needs attention — focus on iron and protein rich foods.")
            if (kid.bmi < 14f) appendLine("BMI is low — suggest calorie-dense nutritious Indian foods.")
            if (kid.bmi > 19.5f) appendLine("BMI is high — suggest lighter fibre-rich Indian options.")
            appendLine("Generate a personalised Indian diet coaching tip as JSON.")
        }

        try {
            val messages = buildJsonArray {
                add(buildJsonObject {
                    put("role", "system")
                    put("content", systemPrompt)
                })
                add(buildJsonObject {
                    put("role", "user")
                    put("content", userPrompt)
                })
            }
            val body = buildJsonObject {
                put("model", MODEL)
                put("messages", messages)
                put("temperature", 0.7)
                put("max_tokens", 400)
            }

            val url = "$toolkitUrl/v2/vercel/v1/chat/completions"
            if (toolkitUrl.isBlank() || toolkitKey.isBlank()) {
                return@withContext fallbackTip(kid, streak)
            }

            val http = ApiService.http
            val resp = http.post(url) {
                header("Authorization", "Bearer $toolkitKey")
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }

            val text = resp.bodyAsText()
            val json = Json { ignoreUnknownKeys = true; isLenient = true }
            val parsed = json.decodeFromString<ChatCompletionResponse>(text)
            val content = parsed.choices.firstOrNull()?.message?.content ?: ""

            val aiJson = try {
                json.decodeFromString<AIDietJson>(content.trim())
            } catch (_: Exception) {
                val jsonBlock = content
                    .substringAfter("```json", "")
                    .substringBefore("```", "")
                    .ifBlank { content.substringAfter("```", "").substringBefore("```") }
                    .trim()
                try { json.decodeFromString<AIDietJson>(jsonBlock) }
                catch (_: Exception) { fallbackTip(kid, streak).let { f ->
                    AIDietJson(f.greeting, f.insight, f.suggestion, f.funFact) }
                }
            }

            AIDietContent(
                greeting = aiJson.greeting,
                insight = aiJson.insight,
                suggestion = aiJson.suggestion,
                funFact = aiJson.funFact,
                generatedAt = "AI-generated for ${kid.name}",
                isGenerating = false,
            )
        } catch (e: Exception) {
            fallbackTip(kid, streak)
        }
    }

    private fun fallbackTip(kid: Kid, streak: StreakInfo): AIDietContent {
        val age = kid.age
        val name = kid.name
        val greeting = when {
            kid.nutrition == HealthFlag.GOOD -> "Great job, $name's eating well!"
            kid.nutrition == HealthFlag.WATCH -> "Let's boost $name's nutrition!"
            else -> "$name needs some extra care with meals"
        }
        val insight = when {
            age <= 6 -> "Kids $age and under need calcium-rich foods for strong bones. Milk, curd, and ragi are excellent choices."
            age <= 10 -> "At age $age, $name needs plenty of protein for growth spurts. Eggs, dal, paneer, and sprouts build muscle."
            else -> "Growing teens like $name need iron-rich foods. Include green leafy veggies, dates, and jaggery daily."
        }
        val suggestion = when {
            kid.nutrition == HealthFlag.WATCH -> "Try adding a boiled egg or a bowl of sprout chaat to $name's evening snack."
            kid.bmi < 14f -> "Add a handful of nuts and a banana to $name's day."
            kid.bmi > 19.5f -> "Swap packaged snacks with cucumber/carrot sticks and roasted chana."
            else -> "Keep up the great balance! Rotate between dal-rice, khichdi, idli-sambar, and roti-sabzi."
        }
        val funFact = listOf(
            "Soaking almonds overnight removes tannins and makes nutrients easier to absorb!",
            "Vitamin C from lemon on dal helps absorb iron 3x better.",
            "Ragi (finger millet) has 10x more calcium than rice.",
            "Curd has probiotics that keep the gut healthy and boost immunity.",
            "Jaggery has iron and minerals that refined sugar doesn't."
        ).random()

        return AIDietContent(
            greeting = greeting, insight = insight,
            suggestion = suggestion, funFact = funFact,
            generatedAt = "Generated for $name", isGenerating = false,
        )
    }

    @Serializable
    data class ChatCompletionResponse(val choices: List<Choice> = emptyList())

    @Serializable
    data class Choice(val message: Message = Message())

    @Serializable
    data class Message(val content: String = "")

    @Serializable
    data class AIDietJson(
        val greeting: String = "",
        val insight: String = "",
        val suggestion: String = "",
        val funFact: String = ""
    )
}
