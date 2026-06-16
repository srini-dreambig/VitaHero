package com.rork.vitahero.ui.navigation

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.rork.vitahero.data.AppViewModel
import com.rork.vitahero.data.PdfReportGenerator
import com.rork.vitahero.data.ReportData
import com.rork.vitahero.data.rememberVitaHeroViewModels
import com.rork.vitahero.ui.screens.AddKidScreen
import com.rork.vitahero.ui.screens.AuthScreen
import com.rork.vitahero.ui.screens.BookingScreen
import com.rork.vitahero.ui.screens.CampDetailScreen
import com.rork.vitahero.ui.screens.CampsScreen
import com.rork.vitahero.ui.screens.ConsentScreen
import com.rork.vitahero.ui.screens.DietScreen
import com.rork.vitahero.ui.screens.FamilySharingScreen
import com.rork.vitahero.ui.screens.FoodRecognitionScreen
import com.rork.vitahero.ui.screens.GrowthChartsScreen
import com.rork.vitahero.ui.screens.HospitalsScreen
import com.rork.vitahero.ui.screens.KidDetailScreen
import com.rork.vitahero.ui.screens.MainScaffold
import com.rork.vitahero.ui.screens.NotificationsScreen
import com.rork.vitahero.ui.screens.OnboardingScreen
import com.rork.vitahero.ui.screens.OtpScreen
import com.rork.vitahero.ui.screens.SchoolsScreen

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
    const val SCHOOLS = "schools"
    const val CAMP_DETAIL = "camp/{campId}"
    const val GROWTH_CHARTS = "growth/{kidId}"
    const val HOSPITALS = "hospitals"
}

private val OnboardingImages = listOf(
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/6cdc1d51-87b7-4ac2-b9f4-aa840c15f557.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/acc98ce6-ff4d-4751-9aa8-f9cbeaab5ef0.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/005133bc-db8d-4bb9-8764-a3ae623d1217.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/a41bb966-8782-450c-89fe-875fb2730090.png",
)

@Composable
fun AppNavigation(
    onGoogleSignInRequest: () -> Unit = {},
) {
    val navController = rememberNavController()
    val vms = rememberVitaHeroViewModels()
    val appViewModel = vms.app
    val kidsViewModel = vms.kids
    val campsViewModel = vms.camps
    val bookingViewModel = vms.booking
    val profileViewModel = vms.profile

    val state by appViewModel.uiState.collectAsState()
    val onboardingComplete by appViewModel.onboardingComplete.collectAsState()
    val isLoggedIn by appViewModel.isLoggedIn.collectAsState()
    val authLoading by appViewModel.authLoading.collectAsState()
    val authError by appViewModel.authError.collectAsState()

    var phone by rememberSaveable { mutableStateOf("") }
    var pendingName by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(isLoggedIn) {
        if (isLoggedIn) {
            navController.navigate(Routes.MAIN) {
                popUpTo(Routes.CONSENT) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    LaunchedEffect(isLoggedIn, state.kids) {
        if (isLoggedIn) {
            state.kids.forEach { kidsViewModel.refreshLeaderboard(it.id) }
        }
    }

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
                    val code = profileViewModel.generateFamilyCodeIfNeeded()
                    appViewModel.acceptConsent(code)
                    navController.navigate(Routes.ONBOARDING) {
                        popUpTo(Routes.CONSENT) { inclusive = true }
                    }
                },
                onDecline = {
                    appViewModel.declineConsent()
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
            LaunchedEffect(Unit) { appViewModel.clearAuthError() }

            AuthScreen(
                isLoading = authLoading,
                authError = authError,
                onSignInWithGoogle = { onGoogleSignInRequest() },
                onSignUpWithEmail = { name, email, password ->
                    appViewModel.signUpWithEmail(name, email, password)
                },
                onSignInWithEmail = { email, password ->
                    appViewModel.signInWithEmail(email, password)
                },
                onContinueWithPhone = { p ->
                    phone = p
                    pendingName = "Parent"
                    appViewModel.sendPhoneOtp(p)
                    navController.navigate("otp/$p/$pendingName")
                },
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

            LaunchedEffect(Unit) { appViewModel.clearAuthError() }

            val otpError by appViewModel.authError.collectAsState()
            val otpVerifying by appViewModel.authLoading.collectAsState()

            OtpScreen(
                phone = p,
                parentName = n,
                onBack = {
                    appViewModel.clearAuthError()
                    appViewModel.clearAuthLoading()
                    navController.popBackStack()
                },
                onVerified = { code ->
                    appViewModel.verifyPhoneOtp(p, code)
                },
                onResend = { appViewModel.sendPhoneOtp(p) },
                isVerifying = otpVerifying,
                error = otpError
            )
        }

        composable(Routes.MAIN) {
            MainScaffold(
                appViewModel = appViewModel,
                profileViewModel = profileViewModel,
                kidsViewModel = kidsViewModel,
                phone = state.phone,
                darkTheme = state.darkTheme,
                onOpenKid = { navController.navigate("kid/$it") },
                onOpenDiet = { navController.navigate("diet/$it") },
                onOpenBooking = { navController.navigate(Routes.BOOKING) },
                onOpenNotifications = { navController.navigate(Routes.NOTIFICATIONS) },
                onAddKid = { navController.navigate(Routes.ADD_KID) },
                onOpenFamilySharing = { navController.navigate(Routes.FAMILY_SHARING) },
                onOpenSchools = { navController.navigate(Routes.SCHOOLS) },
                onOpenHospitals = { navController.navigate(Routes.HOSPITALS) },
                onOpenCamp = { navController.navigate("camp/$it") },
                onOpenGrowthCharts = { navController.navigate("growth/$it") },
                onOpenFoodRecognition = { kidId, kidName ->
                    navController.navigate("foodRecognition/$kidId/$kidName")
                },
                onLogout = {
                    appViewModel.logout()
                    navController.navigate(Routes.AUTH) {
                        popUpTo(Routes.MAIN) { inclusive = true }
                    }
                }
            )
        }

        composable(
            Routes.KID_DETAIL,
            arguments = listOf(navArgument("kidId") { type = NavType.StringType })
        ) { backStack ->
            val kid = kidsViewModel.kidById(backStack.arguments?.getString("kidId"))
            if (kid != null) {
                val meals = kidsViewModel.mealsForKid(kid.id)
                val streak = kidsViewModel.streakForKid(kid.id)
                val badges = kidsViewModel.badgeProgressForKid(kid.id).badges
                val wearableData = state.wearableData[kid.id]
                KidDetailScreen(
                    kid = kid,
                    wearableData = wearableData,
                    onBack = { navController.popBackStack() },
                    onOpenDiet = { navController.navigate("diet/${kid.id}") },
                    onShareReport = { ctx ->
                        val reportData = ReportData(kid, meals, streak, badges)
                        val file = PdfReportGenerator.generate(ctx, reportData)
                        PdfReportGenerator.shareReport(ctx, file)
                    },
                    onAddGrowth = { height, weight, label ->
                        kidsViewModel.addGrowthPoint(kid.id, height, weight, label)
                    },
                    onRefreshWearable = { kidsViewModel.refreshWearableData(kid.id) },
                    onDeleteKid = {
                        kidsViewModel.deleteKid(kid.id) {
                            navController.popBackStack()
                        }
                    },
                    onOpenGrowthCharts = { navController.navigate("growth/${kid.id}") },
                    growthAssessment = kidsViewModel.growthAssessmentForKid(kid.id),
                )
            }
        }

        composable(
            Routes.DIET,
            arguments = listOf(navArgument("kidId") { type = NavType.StringType })
        ) { backStack ->
            val kidId = backStack.arguments?.getString("kidId").orEmpty()
            val kid = kidsViewModel.kidById(kidId)
            val meals by kidsViewModel.meals.collectAsState()
            val aiContent by kidsViewModel.aiContent.collectAsState()
            if (kid != null) {
                DietScreen(
                    kidName = kid.name,
                    kidId = kidId,
                    meals = meals[kidId].orEmpty(),
                    aiContent = aiContent[kidId],
                    onBack = { navController.popBackStack() },
                    onToggleMeal = { kidsViewModel.toggleMeal(kidId, it) },
                    onGenerateAI = { kidsViewModel.generateAIContent(kidId) },
                    onOpenFoodRecognition = {
                        navController.navigate("foodRecognition/$kidId/${kid.name}")
                    }
                )
            }
        }

        composable(Routes.BOOKING) {
            val state by appViewModel.uiState.collectAsState()
            val bookingSlotsMap by bookingViewModel.bookingSlots.collectAsState()
            val ctx = LocalContext.current
            BookingScreen(
                directory = state.bookingDirectory,
                doctors = state.doctors,
                kids = state.kids,
                appointments = state.appointments,
                bookingCity = state.bookingCity,
                locationEnabled = state.locationEnabled,
                onBack = { navController.popBackStack() },
                onCityChange = { bookingViewModel.refreshBookingDirectory(it) },
                onUseMyLocation = { bookingViewModel.fetchLocationAndRefresh(ctx) },
                bookingSlotsByDoctor = bookingSlotsMap,
                onLoadSlots = { bookingViewModel.loadBookingSlots(it) },
                onConfirm = { doctor, kidName, date, time ->
                    bookingViewModel.bookAppointment(doctor, kidName, date, time)
                },
                onCancel = { bookingViewModel.cancelAppointment(it) }
            )
        }

        composable(Routes.HOSPITALS) {
            val state by appViewModel.uiState.collectAsState()
            val ctx = LocalContext.current
            LaunchedEffect(Unit) {
                if (state.bookingDirectory == null) {
                    bookingViewModel.refreshBookingDirectory()
                }
            }
            HospitalsScreen(
                directory = state.bookingDirectory,
                bookingCity = state.bookingCity,
                locationEnabled = state.locationEnabled,
                onBack = { navController.popBackStack() },
                onCityChange = { bookingViewModel.refreshBookingDirectory(it) },
                onUseMyLocation = { bookingViewModel.fetchLocationAndRefresh(ctx) },
                onBookAppointment = { navController.navigate(Routes.BOOKING) },
            )
        }

        composable(Routes.NOTIFICATIONS) {
            val state by appViewModel.uiState.collectAsState()
            NotificationsScreen(
                notifications = state.notifications,
                onBack = {
                    profileViewModel.markAllNotificationsRead()
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.ADD_KID) {
            AddKidScreen(
                onBack = { navController.popBackStack() },
                onSave = { name, age, gender, school, grade, height, weight ->
                    kidsViewModel.addKid(name, age, gender, school, grade, height, weight)
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.SCHOOLS) {
            val state by appViewModel.uiState.collectAsState()
            SchoolsScreen(
                partnerSchools = state.partnerSchools,
                availableSchools = state.availableSchools,
                kids = state.kids,
                onBack = { navController.popBackStack() },
                onEnroll = { code, kidId -> campsViewModel.enrollInSchool(code, kidId) },
            )
        }

        composable(
            Routes.CAMP_DETAIL,
            arguments = listOf(navArgument("campId") { type = NavType.StringType })
        ) { backStack ->
            val campId = backStack.arguments?.getString("campId").orEmpty()
            val camp = campsViewModel.campById(campId)
            val state by appViewModel.uiState.collectAsState()
            if (camp != null) {
                CampDetailScreen(
                    camp = camp,
                    kids = state.kids,
                    onBack = { navController.popBackStack() },
                    onRegister = { kidId ->
                        campsViewModel.registerForCamp(camp, kidId) {
                            profileViewModel.scheduleAllNotifications()
                        }
                    },
                    onBookFollowUp = { navController.navigate(Routes.BOOKING) },
                )
            }
        }

        composable(
            Routes.GROWTH_CHARTS,
            arguments = listOf(navArgument("kidId") { type = NavType.StringType })
        ) { backStack ->
            val kid = kidsViewModel.kidById(backStack.arguments?.getString("kidId"))
            if (kid != null) {
                GrowthChartsScreen(
                    kid = kid,
                    assessment = kidsViewModel.growthAssessmentForKid(kid.id),
                    onBack = { navController.popBackStack() },
                )
            }
        }

        composable(Routes.FAMILY_SHARING) {
            val state by appViewModel.uiState.collectAsState()
            FamilySharingScreen(
                familyCode = state.familyCode,
                coParents = state.coParents,
                onBack = { navController.popBackStack() },
                onJoinFamily = { profileViewModel.joinFamily(it, kidsViewModel) },
                onGenerateCode = { profileViewModel.generateFamilyCode() },
                onShareCode = {
                    val code = state.familyCode
                    val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(android.content.Intent.EXTRA_TEXT, "Join me on VitaHero! Use family code: $code")
                        putExtra(android.content.Intent.EXTRA_SUBJECT, "VitaHero Family Sharing")
                    }
                    navController.context.startActivity(android.content.Intent.createChooser(intent, "Share family code"))
                }
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
                    kidsViewModel.addMealItem(
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
