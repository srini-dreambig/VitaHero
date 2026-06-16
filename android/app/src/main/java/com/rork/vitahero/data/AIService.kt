package com.rork.vitahero.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * AI Diet Coach — calls the backend worker (Toolkit secrets stay server-side).
 */
object AIService {

    suspend fun generateDietTip(
        kid: Kid,
        meals: List<MealItem>,
        streak: StreakInfo,
    ): AIDietContent = withContext(Dispatchers.IO) {
        if (ApiService.isConfigured && !ApiService.sessionToken.isNullOrBlank()) {
            ApiRepositoryProvider.repository.generateAiDietTip(kid.id)?.content?.let { tip ->
                if (tip.greeting.isNotBlank()) {
                    return@withContext AIDietContent(
                        greeting = tip.greeting,
                        insight = tip.insight,
                        suggestion = tip.suggestion,
                        funFact = tip.funFact,
                        generatedAt = tip.generatedAt.ifBlank { "AI-generated for ${kid.name}" },
                        isGenerating = false,
                    )
                }
            }
        }
        fallbackTip(kid, streak)
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
            "Jaggery has iron and minerals that refined sugar doesn't.",
        ).random()

        return AIDietContent(
            greeting = greeting,
            insight = insight,
            suggestion = suggestion,
            funFact = funFact,
            generatedAt = "Generated for $name",
            isGenerating = false,
        )
    }
}
