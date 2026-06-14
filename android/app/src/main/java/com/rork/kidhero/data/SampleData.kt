package com.rork.kidhero.data

object SampleData {

    val rahul = Kid(
        id = "k1",
        name = "Rahul",
        age = 9,
        gender = "Boy",
        school = "Oakridge Intl School",
        grade = "Class 4-B",
        heightCm = 132f,
        weightKg = 29f,
        avatarColor = 0xFF2563EB,
        overallScore = 92,
        growth = listOf(
            GrowthPoint("Jan", 128f, 26.5f),
            GrowthPoint("Mar", 129.5f, 27f),
            GrowthPoint("May", 130.5f, 27.8f),
            GrowthPoint("Jul", 131f, 28.2f),
            GrowthPoint("Sep", 131.6f, 28.6f),
            GrowthPoint("Nov", 132f, 29f),
        ),
        dental = HealthFlag.GOOD,
        eyesight = HealthFlag.WATCH,
        nutrition = HealthFlag.GOOD,
        lastCheckup = "12 May 2026"
    )

    val ananya = Kid(
        id = "k2",
        name = "Ananya",
        age = 7,
        gender = "Girl",
        school = "Oakridge Intl School",
        grade = "Class 2-A",
        heightCm = 118f,
        weightKg = 21f,
        avatarColor = 0xFFFB7185,
        overallScore = 78,
        growth = listOf(
            GrowthPoint("Jan", 113f, 19f),
            GrowthPoint("Mar", 114f, 19.4f),
            GrowthPoint("May", 115f, 19.9f),
            GrowthPoint("Jul", 116f, 20.3f),
            GrowthPoint("Sep", 117f, 20.6f),
            GrowthPoint("Nov", 118f, 21f),
        ),
        dental = HealthFlag.WATCH,
        eyesight = HealthFlag.GOOD,
        nutrition = HealthFlag.WATCH,
        lastCheckup = "12 May 2026"
    )

    val kids = listOf(rahul, ananya)

    val camps = listOf(
        Camp(
            id = "c1",
            title = "Annual Health & Growth Camp",
            school = "Oakridge Intl School",
            date = "24 Jun 2026",
            time = "9:00 AM – 1:00 PM",
            status = CampStatus.UPCOMING,
            checks = listOf("Height & Weight", "Dental", "Eye Test", "Hemoglobin"),
            resultSummary = null
        ),
        Camp(
            id = "c2",
            title = "Vision & Dental Screening",
            school = "Oakridge Intl School",
            date = "12 May 2026",
            time = "10:00 AM – 12:30 PM",
            status = CampStatus.COMPLETED,
            checks = listOf("Dental", "Eye Test"),
            resultSummary = "2 kids screened · 1 follow-up recommended"
        ),
        Camp(
            id = "c3",
            title = "Nutrition & BMI Camp",
            school = "Oakridge Intl School",
            date = "08 Feb 2026",
            time = "9:30 AM – 12:00 PM",
            status = CampStatus.COMPLETED,
            checks = listOf("Height & Weight", "Diet Counselling"),
            resultSummary = "Growth on track for both kids"
        ),
    )

    val doctors = listOf(
        Doctor("d1", "Dr. Meera Nair", "Pediatrician", "Rainbow Children's Hospital", 4.9f, "Today, 4:30 PM", 0xFF10B981),
        Doctor("d2", "Dr. Arjun Rao", "Ophthalmologist", "LV Prasad Eye Institute", 4.8f, "Tomorrow, 11:00 AM", 0xFF2563EB),
        Doctor("d3", "Dr. Kavya Reddy", "Pediatric Dentist", "Smile Care Dental", 4.7f, "Wed, 5:15 PM", 0xFF8B5CF6),
        Doctor("d4", "Dr. Sanjay Gupta", "Nutritionist", "Apollo Cradle", 4.9f, "Thu, 10:00 AM", 0xFFF59E0B),
    )

    val appointments = listOf(
        Appointment("a1", "Dr. Arjun Rao", "Ophthalmologist", "Rahul", "18 Jun 2026", "11:00 AM"),
        Appointment("a2", "Dr. Kavya Reddy", "Pediatric Dentist", "Ananya", "21 Jun 2026", "5:15 PM"),
    )

    fun mealsFor(kidName: String): List<MealItem> = listOf(
        MealItem("m1", "Breakfast", "Veg Poha + Milk", "Flattened rice with peas, peanuts & a glass of milk", 320, true),
        MealItem("m2", "Mid-morning", "Banana + Almonds", "1 banana with 5 soaked almonds", 150, true),
        MealItem("m3", "Lunch", "Dal, Rice & Sabzi", "Toor dal, steamed rice, mixed veg & curd", 480, false),
        MealItem("m4", "Evening", "Sprouts Chaat", "Moong sprouts with tomato, onion & lemon", 180, false),
        MealItem("m5", "Dinner", "Roti + Paneer Bhurji", "2 phulka, paneer bhurji & a bowl of salad", 420, false),
    )

    fun badgesFor(kidName: String): List<Badge> = listOf(
        Badge("b1", "Super Eater", "Logged all meals for 7 days", true, 1f, 0xFF10B981),
        Badge("b2", "Growth Champion", "Height on track 3 camps in a row", true, 1f, 0xFF2563EB),
        Badge("b3", "Hydration Hero", "Drank enough water all week", true, 1f, 0xFF06B6D4),
        Badge("b4", "Bright Smile", "No cavities at last dental check", false, 0.6f, 0xFF8B5CF6),
        Badge("b5", "Active Star", "Played 60 min daily for 5 days", false, 0.4f, 0xFFF59E0B),
        Badge("b6", "Veggie Warrior", "Ate veggies in 10 meals", false, 0.8f, 0xFFFB7185),
    )

    val leaderboard = listOf(
        LeaderEntry(1, "Hero #214", 1840, false),
        LeaderEntry(2, "Rahul (You)", 1720, true),
        LeaderEntry(3, "Hero #087", 1610, false),
        LeaderEntry(4, "Hero #156", 1540, false),
        LeaderEntry(5, "Hero #033", 1490, false),
    )

    val notifications = listOf(
        AppNotification("n1", "Camp coming up", "Annual Health & Growth Camp at Oakridge on 24 Jun. Get Rahul & Ananya ready!", "2h ago", NotificationType.CAMP, true),
        AppNotification("n2", "Eye follow-up suggested", "Rahul's last screening flagged mild vision strain. Book a check-up.", "1d ago", NotificationType.CHECKUP, true),
        AppNotification("n3", "Lunch not logged", "Don't forget to mark Ananya's lunch to earn the Super Eater badge.", "1d ago", NotificationType.DIET, false),
        AppNotification("n4", "New badge unlocked!", "Rahul earned the Hydration Hero badge. Way to go!", "3d ago", NotificationType.REWARD, false),
    )
}
