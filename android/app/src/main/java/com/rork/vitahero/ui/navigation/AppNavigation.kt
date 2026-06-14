package com.rork.vitahero.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.rork.vitahero.data.AppViewModel
import com.rork.vitahero.data.ReportData
import com.rork.vitahero.ui.screens.AddKidScreen
import com.rork.vitahero.ui.screens.AuthScreen
import com.rork.vitahero.ui.screens.BookingScreen
import com.rork.vitahero.ui.screens.ConsentScreen
import com.rork.vitahero.ui.screens.DietScreen
import com.rork.vitahero.ui.screens.FamilySharingScreen
import com.rork.vitahero.ui.screens.FoodRecognitionScreen
import com.rork.vitahero.ui.screens.KidDetailScreen
import com.rork.vitahero.ui.screens.MainScaffold
import com.rork.vitahero.ui.screens.NotificationsScreen
import com.rork.vitahero.ui.screens.OnboardingScreen
import com.rork.vitahero.ui.screens.OtpScreen

object Routes {
    const val CONSENT = "consent"
    const val ONBOARDING = "onboarding"
    const val AUTH = "auth"
    const val OTP = "otp/{phone}/{name}"
    const val MAIN = "main"
    const val KID_DETAIL = "kid/{kidId}"
    const val DIET = "diet/{kidId}"
    const val BOOKING = "booking"
    const val NOTIFICATIONS = "notifications"
    const val ADD_KID = "addKid"
    const val FAMILY_SHARING = "familySharing"
    const val FOOD_RECOGNITION = "foodRecognition/{kidId}/{kidName}"
}

private val OnboardingImages = listOf(
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/6cdc1d51-87b7-4ac2-b9f4-aa840c15f557.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/acc98ce6-ff4d-4751-9aa8-f9cbeaab5ef0.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/005133bc-db8d-4bb9-8764-a3ae623d1217.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/a41bb966-8782-450c-89fe-875fb2730090.png",
)

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val appViewModel: AppViewModel = viewModel()
    val state by appViewModel.uiState.collectAsState()
    val onboardingComplete by appViewModel.onboardingComplete.collectAsState()
    val isLoggedIn by appViewModel.isLoggedIn.collectAsState()
    var phone by rememberSaveable { mutableStateOf("") }
    var pendingName by rememberSaveable { mutableStateOf("") }

    val startDest = when {
        isLoggedIn -> Routes.MAIN
        onboardingComplete -> Routes.AUTH
        else -> Routes.CONSENT
    }

    NavHost(
        navController = navController,
        startDestination = startDest,
        enterTransition = { fadeIn(tween(220)) },
        exitTransition = { fadeOut(tween(180)) },
        popEnterTransition = { fadeIn(tween(220)) },
        popExitTransition = { fadeOut(tween(180)) }
    ) {
        composable(Routes.CONSENT) {
            ConsentScreen(
                onAccept = {
                    appViewModel.acceptConsent()
                    navController.navigate(Routes.ONBOARDING) {
                        popUpTo(Routes.CONSENT) { inclusive = true }
                    }
                },
                onDecline = {
                    navController.navigate(Routes.ONBOARDING) {
                        popUpTo(Routes.CONSENT) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.ONBOARDING) {
            OnboardingScreen(
                images = OnboardingImages,
                onFinish = {
                    appViewModel.completeOnboarding()
                    navController.navigate(Routes.AUTH) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.AUTH) {
            AuthScreen(
                onContinue = { p, n ->
                    phone = p
                    pendingName = n
                    navController.navigate("otp/$p/${n.ifBlank { "Priya" }}")
                }
            )
        }

        composable(
            Routes.OTP,
            arguments = listOf(
                navArgument("phone") { type = NavType.StringType },
                navArgument("name") { type = NavType.StringType }
            )
        ) { backStack ->
            val p = backStack.arguments?.getString("phone").orEmpty()
            val n = backStack.arguments?.getString("name").orEmpty()
            OtpScreen(
                phone = p,
                parentName = n,
                onBack = { navController.popBackStack() },
                onVerified = {
                    appViewModel.login(p, n)
                    navController.navigate(Routes.MAIN) {
                        popUpTo(Routes.AUTH) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.MAIN) {
            MainScaffold(
                appViewModel = appViewModel,
                phone = state.phone,
                darkTheme = state.darkTheme,
                onOpenKid = { navController.navigate("kid/$it") },
                onOpenDiet = { navController.navigate("diet/$it") },
                onOpenBooking = { navController.navigate(Routes.BOOKING) },
                onOpenNotifications = { navController.navigate(Routes.NOTIFICATIONS) },
                onAddKid = { navController.navigate(Routes.ADD_KID) },
                onOpenFamilySharing = { navController.navigate(Routes.FAMILY_SHARING) },
                onOpenFoodRecognition = { kidId, kidName ->
                    navController.navigate("foodRecognition/$kidId/$kidName")
                },
                onLogout = {
                    appViewModel.logout()
                    navController.navigate(Routes.CONSENT) {
                        popUpTo(Routes.MAIN) { inclusive = true }
                    }
                }
            )
        }

        composable(
            Routes.KID_DETAIL,
            arguments = listOf(navArgument("kidId") { type = NavType.StringType })
        ) { backStack ->
            val kid = appViewModel.kidById(backStack.arguments?.getString("kidId"))
            if (kid != null) {
                val meals = appViewModel.mealsForKid(kid.id)
                val streak = appViewModel.streakForKid(kid.id)
                val badges = appViewModel.badgeProgressForKid(kid.id).badges
                val wearableData = state.wearableData[kid.id]
                KidDetailScreen(
                    kid = kid,
                    wearableData = wearableData,
                    onBack = { navController.popBackStack() },
                    onOpenDiet = { navController.navigate("diet/${kid.id}") },
                    onShareReport = { context ->
                        val reportData = ReportData(kid, meals, streak, badges)
                        val file = com.rork.vitahero.data.PdfReportGenerator.generate(context, reportData)
                        com.rork.vitahero.data.PdfReportGenerator.shareReport(context, file)
                    },
                    onAddGrowth = { height, weight, label ->
                        appViewModel.addGrowthPoint(kid.id, height, weight, label)
                    },
                    onRefreshWearable = { appViewModel.refreshWearableData(kid.id) }
                )
            }
        }

        composable(
            Routes.DIET,
            arguments = listOf(navArgument("kidId") { type = NavType.StringType })
        ) { backStack ->
            val kidId = backStack.arguments?.getString("kidId").orEmpty()
            val kid = appViewModel.kidById(kidId)
            val meals by appViewModel.meals.collectAsState()
            val aiContent by appViewModel.aiContent.collectAsState()
            if (kid != null) {
                DietScreen(
                    kidName = kid.name,
                    kidId = kidId,
                    meals = meals[kidId].orEmpty(),
                    aiContent = aiContent[kidId],
                    onBack = { navController.popBackStack() },
                    onToggleMeal = { appViewModel.toggleMeal(kidId, it) },
                    onGenerateAI = { appViewModel.generateAIContent(kidId) },
                    onOpenFoodRecognition = {
                        navController.navigate("foodRecognition/$kidId/${kid.name}")
                    }
                )
            }
        }

        composable(Routes.BOOKING) {
            val state by appViewModel.uiState.collectAsState()
            BookingScreen(
                doctors = state.doctors,
                kids = state.kids,
                appointments = state.appointments,
                onBack = { navController.popBackStack() },
                onConfirm = { doctor, kidName, date, time ->
                    appViewModel.bookAppointment(doctor, kidName, date, time)
                },
                onCancel = { appViewModel.cancelAppointment(it) }
            )
        }

        composable(Routes.NOTIFICATIONS) {
            val state by appViewModel.uiState.collectAsState()
            NotificationsScreen(
                notifications = state.notifications,
                onBack = {
                    appViewModel.markAllNotificationsRead()
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.ADD_KID) {
            AddKidScreen(
                onBack = { navController.popBackStack() },
                onSave = { name, age, gender, school, grade, height, weight ->
                    appViewModel.addKid(name, age, gender, school, grade, height, weight)
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.FAMILY_SHARING) {
            val state by appViewModel.uiState.collectAsState()
            FamilySharingScreen(
                familyCode = state.familyCode.ifEmpty { "ABC123" },
                coParents = state.coParents,
                onBack = { navController.popBackStack() },
                onJoinFamily = { appViewModel.joinFamily(it) },
                onShareCode = {}
            )
        }

        composable(
            Routes.FOOD_RECOGNITION,
            arguments = listOf(
                navArgument("kidId") { type = NavType.StringType },
                navArgument("kidName") { type = NavType.StringType },
            )
        ) { backStack ->
            val kidId = backStack.arguments?.getString("kidId").orEmpty()
            val kidName = backStack.arguments?.getString("kidName").orEmpty()
            FoodRecognitionScreen(
                kidName = kidName,
                kidId = kidId,
                onBack = { navController.popBackStack() },
                onLogDetectedFood = { id, name, kcal ->
                    appViewModel.addMealItem(
                        kidId = id,
                        name = name,
                        detail = "Detected via food recognition",
                        kcal = kcal,
                        timeSlot = "Snack"
                    )
                }
            )
        }
    }
}
