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
        // NOT_MEASURED used to fall through to "needs extra care" here and to
        // "keep up the great balance" below — the same absence of data read as
        // a problem in one line and as a clean result in the next.
        val greeting = when (kid.nutrition) {
            HealthFlag.GOOD -> "Great job, $name's eating well!"
            HealthFlag.WATCH -> "Let's boost $name's nutrition!"
            HealthFlag.ALERT -> "$name needs some extra care with meals"
            HealthFlag.NOT_MEASURED -> "Everyday ideas for $name"
        }
        val insight = when {
            age <= 6 -> "Kids $age and under need calcium-rich foods for strong bones. Milk, curd, and ragi are excellent choices."
            age <= 10 -> "At age $age, $name needs plenty of protein for growth spurts. Eggs, dal, paneer, and sprouts build muscle."
            else -> "Growing teens like $name need iron-rich foods. Include green leafy veggies, dates, and jaggery daily."
        }
        val suggestion = when (kid.nutrition) {
            HealthFlag.WATCH -> "Try adding a boiled egg or a bowl of sprout chaat to $name's evening snack."
            HealthFlag.ALERT -> "Swap packaged snacks with cucumber/carrot sticks and roasted chana."
            HealthFlag.GOOD -> "Keep up the great balance! Rotate between dal-rice, khichdi, idli-sambar, and roti-sabzi."
            HealthFlag.NOT_MEASURED ->
                "Rotate between dal-rice, khichdi, idli-sambar, and roti-sabzi. " +
                "A school camp has not assessed $name's nutrition yet, so this is general advice."
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
