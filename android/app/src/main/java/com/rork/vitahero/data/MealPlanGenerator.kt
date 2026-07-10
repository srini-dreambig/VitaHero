package com.rork.vitahero.data

import java.util.UUID

/**
 * Generates an initial daily meal plan from a child's age and nutrition flags.
 * Plans sync to Neon via the standard meals API — not static demo data.
 */
object MealPlanGenerator {

    fun initialPlanFor(kid: Kid): List<MealItem> {
        val isYoung = kid.age <= 6
        val needsIron = kid.nutrition == HealthFlag.WATCH || kid.nutrition == HealthFlag.ALERT
        val needsWeight = kid.nutrition == HealthFlag.WATCH

        val breakfast = if (isYoung)
            meal("Breakfast", "Ragi Porridge + Milk", "Ragi cooked in milk with jaggery — calcium boost!", 290)
        else if (needsIron)
            meal("Breakfast", "Methi Thepla + Curd", "Iron-rich fenugreek flatbread with fresh curd", 340)
        else
            meal("Breakfast", "Veg Poha + Milk", "Flattened rice with peas, peanuts & milk", 320)

        val midMorning = if (isYoung)
            meal("Mid-morning", "Mashed Apple + Suji Halwa", "Easy to digest, energy-boosting combo", 160)
        else if (needsWeight)
            meal("Mid-morning", "Banana Shake + Almonds", "Calorie-dense shake with 6 soaked almonds", 220)
        else
            meal("Mid-morning", "Banana + Almonds", "1 banana with 5 soaked almonds", 150)

        val lunch = if (needsIron)
            meal("Lunch", "Dal Palak + Rice + Salad", "Spinach dal with rice, lemon & cucumber salad", 460)
        else if (needsWeight)
            meal("Lunch", "Khichdi + Ghee + Curd", "Moong dal khichdi with ghee, curd & pickle", 520)
        else
            meal("Lunch", "Dal, Rice & Sabzi", "Toor dal, steamed rice, mixed veg & curd", 480)

        val evening = if (isYoung)
            meal("Evening", "Fruit Custard", "Milk custard with seasonal fruits & nuts", 190)
        else if (needsIron)
            meal("Evening", "Dates & Nuts Ladoo", "Dates, almonds, sesame — iron powerhouse", 200)
        else
            meal("Evening", "Sprouts Chaat", "Moong sprouts with tomato, onion & lemon", 180)

        val dinner = if (needsIron)
            meal("Dinner", "Roti + Egg Curry + Salad", "1 boiled egg in gravy with 2 roti & salad", 430)
        else if (isYoung)
            meal("Dinner", "Soft Khichdi + Veggies", "Mild moong-rice khichdi with mashed veg", 350)
        else
            meal("Dinner", "Roti + Paneer Bhurji", "2 phulka, paneer bhurji & a bowl of salad", 420)

        return listOf(breakfast, midMorning, lunch, evening, dinner)
    }

    private fun meal(time: String, name: String, detail: String, kcal: Int): MealItem =
        MealItem(
            id = "m${UUID.randomUUID().toString().take(8)}",
            time = time,
            name = name,
            detail = detail,
            kcal = kcal,
            eaten = false,
        )
}
