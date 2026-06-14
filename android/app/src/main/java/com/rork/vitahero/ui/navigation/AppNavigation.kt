package com.rork.vitahero.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.rork.vitahero.data.AppViewModel
import com.rork.vitahero.ui.screens.AddKidScreen
import com.rork.vitahero.ui.screens.AuthScreen
import com.rork.vitahero.ui.screens.BookingScreen
import com.rork.vitahero.ui.screens.DietScreen
import com.rork.vitahero.ui.screens.KidDetailScreen
import com.rork.vitahero.ui.screens.MainScaffold
import com.rork.vitahero.ui.screens.NotificationsScreen
import com.rork.vitahero.ui.screens.OnboardingScreen
import com.rork.vitahero.ui.screens.OtpScreen

object Routes {
    const val ONBOARDING = "onboarding"
    const val AUTH = "auth"
    const val OTP = "otp/{phone}"
    const val MAIN = "main"
    const val KID_DETAIL = "kid/{kidId}"
    const val DIET = "diet/{kidId}"
    const val BOOKING = "booking"
    const val NOTIFICATIONS = "notifications"
    const val ADD_KID = "addKid"
}

val OnboardingImages = listOf(
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/6cdc1d51-87b7-4ac2-b9f4-aa840c15f557.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/acc98ce6-ff4d-4751-9aa8-f9cbeaab5ef0.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/005133bc-db8d-4bb9-8764-a3ae623d1217.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/a41bb966-8782-450c-89fe-875fb2730090.png",
)

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val appViewModel: AppViewModel = viewModel()
    var phone by rememberSaveable { mutableStateOf("") }

    NavHost(
        navController = navController,
        startDestination = Routes.ONBOARDING,
        enterTransition = { fadeIn(tween(220)) },
        exitTransition = { fadeOut(tween(180)) },
        popEnterTransition = { fadeIn(tween(220)) },
        popExitTransition = { fadeOut(tween(180)) }
    ) {
        composable(Routes.ONBOARDING) {
            OnboardingScreen(
                images = OnboardingImages,
                onFinish = { navController.navigate(Routes.AUTH) }
            )
        }

        composable(Routes.AUTH) {
            AuthScreen(
                onContinue = { p ->
                    phone = p
                    navController.navigate("otp/$p")
                }
            )
        }

        composable(
            Routes.OTP,
            arguments = listOf(navArgument("phone") { type = NavType.StringType })
        ) { backStack ->
            val p = backStack.arguments?.getString("phone").orEmpty()
            OtpScreen(
                phone = p,
                onBack = { navController.popBackStack() },
                onVerified = {
                    navController.navigate(Routes.MAIN) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.MAIN) {
            MainScaffold(
                appViewModel = appViewModel,
                phone = phone,
                onOpenKid = { navController.navigate("kid/$it") },
                onOpenDiet = { navController.navigate("diet/$it") },
                onOpenBooking = { navController.navigate(Routes.BOOKING) },
                onOpenNotifications = { navController.navigate(Routes.NOTIFICATIONS) },
                onAddKid = { navController.navigate(Routes.ADD_KID) },
                onLogout = {
                    navController.navigate(Routes.ONBOARDING) {
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
                KidDetailScreen(
                    kid = kid,
                    onBack = { navController.popBackStack() },
                    onOpenDiet = { navController.navigate("diet/${kid.id}") }
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
            if (kid != null) {
                DietScreen(
                    kidName = kid.name,
                    meals = meals[kidId].orEmpty(),
                    onBack = { navController.popBackStack() },
                    onToggleMeal = { appViewModel.toggleMeal(kidId, it) }
                )
            }
        }

        composable(Routes.BOOKING) {
            val state by appViewModel.uiState.collectAsState()
            BookingScreen(
                doctors = state.doctors,
                kids = state.kids,
                onBack = { navController.popBackStack() },
                onConfirm = { doctor, kidName, date, time ->
                    appViewModel.bookAppointment(doctor, kidName, date, time)
                }
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
    }
}
