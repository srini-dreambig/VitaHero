package com.rork.vitahero.ui.navigation

import android.app.Activity
import android.net.Uri
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import com.rork.vitahero.data.BookingViewModel
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.PdfReportGenerator
import com.rork.vitahero.data.ReportData
import com.rork.vitahero.data.rememberVitaHeroViewModels
import com.rork.vitahero.ui.components.selectAsState
import com.rork.vitahero.ui.screens.ClinicianCampsScreen
import com.rork.vitahero.ui.screens.ClinicianReviewChildScreen
import com.rork.vitahero.ui.screens.ClinicianReviewScreen
import com.rork.vitahero.ui.screens.ClinicianRosterScreen
import com.rork.vitahero.ui.screens.ClinicianScreeningScreen
import com.rork.vitahero.ui.screens.AuthScreen
import com.rork.vitahero.ui.screens.BookingScreen
import com.rork.vitahero.ui.screens.CampConsentScreen
import com.rork.vitahero.ui.screens.CampResultScreen
import com.rork.vitahero.ui.screens.LibraryScreen
import com.rork.vitahero.ui.screens.PrivacyScreen
import com.rork.vitahero.ui.screens.QuestionsScreen
import com.rork.vitahero.ui.screens.ReferralsScreen
import com.rork.vitahero.ui.screens.CampDetailScreen
import com.rork.vitahero.ui.screens.ConsentScreen
import com.rork.vitahero.ui.screens.DietScreen
import com.rork.vitahero.ui.screens.DieticianArticlesScreen
import com.rork.vitahero.ui.screens.DieticianChildScreen
import com.rork.vitahero.ui.screens.DieticianChildrenScreen
import com.rork.vitahero.ui.screens.DieticianSchoolsScreen
import com.rork.vitahero.ui.screens.FamilySharingScreen
import com.rork.vitahero.ui.screens.FoodRecognitionScreen
import com.rork.vitahero.ui.screens.GrowthChartsScreen
import com.rork.vitahero.ui.screens.HospitalsScreen
import com.rork.vitahero.ui.screens.KidDetailMissingScreen
import com.rork.vitahero.ui.screens.KidDetailScreen
import com.rork.vitahero.ui.screens.MainScaffold
import com.rork.vitahero.ui.screens.NotificationsScreen
import com.rork.vitahero.ui.screens.OnboardingScreen
import com.rork.vitahero.ui.screens.OtpScreen
import com.rork.vitahero.ui.screens.SchoolsScreen
import com.rork.vitahero.ui.screens.SplashScreen
import com.rork.vitahero.ui.screens.SymptomScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object Routes {
    const val SPLASH = "splash"
    const val CONSENT = "consent"
    const val ONBOARDING = "onboarding"
    const val AUTH = "auth"
    const val OTP = "otp/{phone}/{name}"
    const val MAIN = "main"

    // The clinician's side of the app. A doctor signing in lands on CLINIC and
    // never sees MAIN: the family screens are not their product, and a camp
    // day is a different job from reading your own child's results.
    const val CLINIC = "clinic"
    const val CLINIC_ROSTER = "clinic/{campId}/{title}"
    const val CLINIC_SCREEN = "clinic/{campId}/child/{kidId}"

    // Review is the step that lets a camp out. It stays a separate route from
    // the roster because it is a different job with a different permission:
    // a screener screens, a physician signs off.
    const val CLINIC_REVIEW = "clinic/{campId}/review/{title}"
    const val CLINIC_REVIEW_CHILD = "clinic/{campId}/review/child/{kidId}"

    // The dietician's side. A school rather than a camp is the unit of work,
    // because a plan runs for weeks and a camp is a day.
    const val DIETICIAN = "dietician"
    const val DIETICIAN_SCHOOL = "dietician/{schoolId}/{name}"
    const val DIETICIAN_CHILD = "dietician/child/{kidId}"
    const val DIETICIAN_ARTICLES = "dietician/articles"
    const val KID_DETAIL = "kid/{kidId}"
    const val DIET = "diet/{kidId}"
    // Optional query arguments, so every existing `bookingRoute()` with no
    // arguments still matches and falls back to the defaults.
    const val BOOKING = "booking?specialty={specialty}&kid={kid}"
    const val NOTIFICATIONS = "notifications"
    const val FAMILY_SHARING = "familySharing"
    const val FOOD_RECOGNITION = "foodRecognition/{kidId}/{kidName}"
    const val SCHOOLS = "schools"
    const val CAMP_DETAIL = "camp/{campId}"
    const val GROWTH_CHARTS = "growth/{kidId}"
    const val HOSPITALS = "hospitals"
    const val CAMP_CONSENT = "campConsent"
    const val CAMP_RESULT = "campResult/{campId}/{kidId}"
    const val REFERRALS = "referrals"
    const val QUESTIONS = "questions"
    const val LIBRARY = "library"
    const val RECORD = "record"
    const val SYMPTOMS = "symptoms/{kidId}"
}

/**
 * Open the booking screen, optionally carrying the referral that sent us.
 *
 * Built here rather than at each call site so the encoding and the argument
 * names live in one place as the route does.
 */
fun bookingRoute(specialty: String = "", kidName: String = ""): String =
    "booking?specialty=${Uri.encode(specialty)}&kid=${Uri.encode(kidName)}"

/**
 * The destinations that exist precisely because nobody is signed in.
 *
 * Written as the exception rather than the rule so that adding a screen does
 * not quietly leave it out: anything not listed here is a signed-in screen and
 * must give way when the session ends.
 */
private val SIGNED_OUT_ROUTES = setOf(
    Routes.SPLASH,
    Routes.CONSENT,
    Routes.ONBOARDING,
    Routes.AUTH,
    Routes.OTP,
)

private val OnboardingImages = listOf(
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/6cdc1d51-87b7-4ac2-b9f4-aa840c15f557.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/acc98ce6-ff4d-4751-9aa8-f9cbeaab5ef0.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/005133bc-db8d-4bb9-8764-a3ae623d1217.png",
    "https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/a41bb966-8782-450c-89fe-875fb2730090.png",
)

@Composable
fun AppNavigation(
    invitePhone: String = "",
) {
    val navController = rememberNavController()
    val vms = rememberVitaHeroViewModels()
    val appViewModel = vms.app
    val kidsViewModel = vms.kids
    val campsViewModel = vms.camps
    val bookingViewModel = vms.booking
    val profileViewModel = vms.profile
    val guardianViewModel = vms.guardian

    // The whole navigation graph is built inside this scope, so what it reads is
    // what re-runs the graph. Four fields, not thirty.
    val darkTheme by appViewModel.uiState.selectAsState { it.darkTheme }
    val kids by appViewModel.uiState.selectAsState { it.kids }
    val profilePhone by appViewModel.uiState.selectAsState { it.phone }
    val wearablesByKid by appViewModel.uiState.selectAsState { it.wearableData }
    val onboardingComplete by appViewModel.onboardingComplete.collectAsState()
    val isLoggedIn by appViewModel.isLoggedIn.collectAsState()
    val authLoading by appViewModel.authLoading.collectAsState()
    val authError by appViewModel.authError.collectAsState()

    // Which product this sign-in opens.
    //
    // The role is restored from disk before the profile comes back, so a
    // doctor reopening the app does not get the family home screen for the
    // second or two a school's wifi takes.
    val role by appViewModel.role.collectAsState()
    val isClinician = role == "PHYSICIAN" || role == "SCREENER"
    val isDietician = role == "DIETICIAN"

    var phone by rememberSaveable { mutableStateOf("") }
    var pendingName by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(isLoggedIn, role) {
        if (isLoggedIn) {
            // Keyed on the role as well as the session. The role arrives with
            // the profile, a moment after isLoggedIn flips, so keying on the
            // session alone would send a doctor to the family home and leave
            // them there.
            val home = when {
                isClinician -> Routes.CLINIC
                isDietician -> Routes.DIETICIAN
                else -> Routes.MAIN
            }
            navController.navigate(home) {
                popUpTo(Routes.SPLASH) { inclusive = true }
                launchSingleTop = true
            }
        } else if (navController.currentDestination?.route !in SIGNED_OUT_ROUTES) {
            // The session ended while the app was open — the server rejected
            // the token, rather than anyone tapping Log out. Only the explicit
            // logout used to navigate, so a parent whose session ended stayed
            // on a screen that could no longer load anything and drew empty
            // lists instead of saying why. AuthScreen carries the reason.
            //
            // Guarded on the current route so the explicit logout, which has
            // already navigated by the time this runs, does not push a second
            // sign-in screen onto the stack.
            navController.navigate(Routes.AUTH) {
                popUpTo(Routes.MAIN) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    LaunchedEffect(isLoggedIn, kids) {
        if (isLoggedIn) {
            kids.forEach { kidsViewModel.refreshLeaderboard(it.id) }
        }
    }

    // Consents, referrals, questions and the plan, once. These are what tell a
    // parent something is waiting for them, so they load with the session
    // rather than when a screen is first opened.
    LaunchedEffect(isLoggedIn) {
        if (isLoggedIn) guardianViewModel.refreshAll()
    }
    val pendingConsents by guardianViewModel.pendingConsents.collectAsState()
    val dietPlans by guardianViewModel.dietPlans.collectAsState()

    val startDest = when {
        isLoggedIn && isClinician -> Routes.CLINIC
        isLoggedIn && isDietician -> Routes.DIETICIAN
        isLoggedIn -> Routes.MAIN
        onboardingComplete -> Routes.AUTH
        else -> Routes.CONSENT
    }

    NavHost(
        navController = navController,
        startDestination = Routes.SPLASH,
        enterTransition = { fadeIn(tween(220)) },
        exitTransition = { fadeOut(tween(180)) },
        popEnterTransition = { fadeIn(tween(220)) },
        popExitTransition = { fadeOut(tween(180)) }
    ) {
        composable(Routes.SPLASH) {
            SplashScreen(
                onTimeout = {
                    // If a session restored while the splash was showing, the top-level
                    // effect already routed to MAIN and this destination is gone.
                    if (!isLoggedIn) {
                        navController.navigate(startDest) {
                            popUpTo(Routes.SPLASH) { inclusive = true }
                            launchSingleTop = true
                        }
                    }
                }
            )
        }

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
            val activity = LocalContext.current as? Activity

            AuthScreen(
                isLoading = authLoading,
                authError = authError,
                prefilledPhone = invitePhone,
                onContinueWithPhone = { p ->
                    phone = p
                    pendingName = "Parent"
                    activity?.let { appViewModel.requestPhoneOtp(it, p) }
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
            val activity = LocalContext.current as? Activity

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
                onResend = { activity?.let { appViewModel.resendPhoneOtp(it, p) } },
                isVerifying = otpVerifying,
                error = otpError
            )
        }

        // ── The clinician's side ────────────────────────────
        //
        // Three screens and no bottom bar: a camp day is a sequence, not a set
        // of places to browse. My camps → this camp's children → this child's
        // form, and back out the way you came in.
        // ── The dietician's side ────────────────────────────
        //
        // My schools → the children at one of them → one child and their plan.
        // The same shape as the clinician's sequence and for the same reason:
        // this is a job with a next step, not a set of places to browse.
        composable(Routes.DIETICIAN) {
            DieticianSchoolsScreen(
                dietician = vms.dietician,
                onOpenSchool = { schoolId, name ->
                    navController.navigate("dietician/$schoolId/${Uri.encode(name)}")
                },
                onOpenArticles = { navController.navigate(Routes.DIETICIAN_ARTICLES) },
                onLogout = {
                    appViewModel.logout()
                    navController.navigate(Routes.AUTH) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }

        composable(
            Routes.DIETICIAN_SCHOOL,
            arguments = listOf(
                navArgument("schoolId") { type = NavType.StringType },
                navArgument("name") { type = NavType.StringType },
            ),
        ) { backStack ->
            DieticianChildrenScreen(
                schoolId = backStack.arguments?.getString("schoolId").orEmpty(),
                schoolName = backStack.arguments?.getString("name").orEmpty(),
                dietician = vms.dietician,
                onOpenChild = { kidId -> navController.navigate("dietician/child/$kidId") },
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            Routes.DIETICIAN_CHILD,
            arguments = listOf(navArgument("kidId") { type = NavType.StringType }),
        ) { backStack ->
            DieticianChildScreen(
                kidId = backStack.arguments?.getString("kidId").orEmpty(),
                dietician = vms.dietician,
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.DIETICIAN_ARTICLES) {
            DieticianArticlesScreen(
                dietician = vms.dietician,
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.CLINIC) {
            val clinicianName by appViewModel.signedInName.collectAsState()
            ClinicianCampsScreen(
                clinician = vms.clinician,
                clinicianName = clinicianName,
                onOpenCamp = { campId, title ->
                    navController.navigate("clinic/$campId/${Uri.encode(title)}")
                },
                onLogout = {
                    appViewModel.logout()
                    navController.navigate(Routes.AUTH) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }

        composable(
            Routes.CLINIC_ROSTER,
            arguments = listOf(
                navArgument("campId") { type = NavType.StringType },
                navArgument("title") { type = NavType.StringType },
            ),
        ) { backStack ->
            val campId = backStack.arguments?.getString("campId").orEmpty()
            val title = backStack.arguments?.getString("title").orEmpty()
            ClinicianRosterScreen(
                campTitle = title,
                campId = campId,
                clinician = vms.clinician,
                onOpenChild = { kidId -> navController.navigate("clinic/$campId/child/$kidId") },
                onOpenReview = {
                    navController.navigate("clinic/$campId/review/${Uri.encode(title)}")
                },
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            Routes.CLINIC_SCREEN,
            arguments = listOf(
                navArgument("campId") { type = NavType.StringType },
                navArgument("kidId") { type = NavType.StringType },
            ),
        ) { backStack ->
            ClinicianScreeningScreen(
                campId = backStack.arguments?.getString("campId").orEmpty(),
                kidId = backStack.arguments?.getString("kidId").orEmpty(),
                clinician = vms.clinician,
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            Routes.CLINIC_REVIEW,
            arguments = listOf(
                navArgument("campId") { type = NavType.StringType },
                navArgument("title") { type = NavType.StringType },
            ),
        ) { backStack ->
            val campId = backStack.arguments?.getString("campId").orEmpty()
            ClinicianReviewScreen(
                campId = campId,
                campTitle = backStack.arguments?.getString("title").orEmpty(),
                clinician = vms.clinician,
                onOpenChild = { kidId ->
                    navController.navigate("clinic/$campId/review/child/$kidId")
                },
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            Routes.CLINIC_REVIEW_CHILD,
            arguments = listOf(
                navArgument("campId") { type = NavType.StringType },
                navArgument("kidId") { type = NavType.StringType },
            ),
        ) { backStack ->
            ClinicianReviewChildScreen(
                campId = backStack.arguments?.getString("campId").orEmpty(),
                kidId = backStack.arguments?.getString("kidId").orEmpty(),
                clinician = vms.clinician,
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.MAIN) {
            MainScaffold(
                appViewModel = appViewModel,
                profileViewModel = profileViewModel,
                kidsViewModel = kidsViewModel,
                phone = profilePhone,
                darkTheme = darkTheme,
                onOpenKid = { navController.navigate("kid/$it") },
                onOpenDiet = { navController.navigate("diet/$it") },
                onOpenBooking = { navController.navigate(bookingRoute()) },
                onOpenNotifications = { navController.navigate(Routes.NOTIFICATIONS) },
                onOpenFamilySharing = { navController.navigate(Routes.FAMILY_SHARING) },
                onOpenSchools = { navController.navigate(Routes.SCHOOLS) },
                onOpenHospitals = { navController.navigate(Routes.HOSPITALS) },
                onOpenCamp = { navController.navigate("camp/$it") },
                onOpenConsent = { navController.navigate(Routes.CAMP_CONSENT) },
                onOpenReferrals = { navController.navigate(Routes.REFERRALS) },
                onOpenQuestions = { navController.navigate(Routes.QUESTIONS) },
                onOpenLibrary = { navController.navigate(Routes.LIBRARY) },
                onOpenRecord = { navController.navigate(Routes.RECORD) },
                pendingConsents = pendingConsents.size,
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
                val wearableData = wearablesByKid[kid.id]
                val reportLocale = LocalAppLocale.current
                KidDetailScreen(
                    kid = kid,
                    wearableData = wearableData,
                    onBack = { navController.popBackStack() },
                    onOpenDiet = { navController.navigate("diet/${kid.id}") },
                    onShareReport = { ctx ->
                        val reportData = ReportData(kid, meals, streak, badges)
                        // Drawing a PDF page and writing it to disk is not main
                        // thread work; it used to be, and on a slower phone that
                        // is a visible freeze or an ANR. Only the share sheet
                        // needs to be raised from the main thread.
                        val file = withContext(Dispatchers.Default) {
                            PdfReportGenerator.generate(ctx, reportData, reportLocale)
                        }
                        PdfReportGenerator.shareReport(ctx, file)
                    },
                    onRefreshWearable = { kidsViewModel.refreshWearableData(kid.id) },
                    onLogSymptom = { navController.navigate("symptoms/${kid.id}") },
                    onOpenGrowthCharts = { navController.navigate("growth/${kid.id}") },
                    growthAssessment = kidsViewModel.growthAssessmentForKid(kid.id),
                )
            } else {
                // A route id with no matching child must never render a blank
                // screen (which reads as a freeze) — it gets an explanation.
                KidDetailMissingScreen(onBack = { navController.popBackStack() })
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
            LaunchedEffect(kidId) { guardianViewModel.loadDietPlan(kidId) }
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
                    },
                    // The burnt half of the day. Read here rather than on the
                    // child's detail screen alone, so the two numbers the
                    // habit loop is about sit beside each other.
                    wearable = wearablesByKid[kidId],
                    onConnectWearable = { kidsViewModel.refreshWearableData(kidId) },
                    plan = dietPlans[kidId],
                )
            }
        }

        composable(
            Routes.BOOKING,
            arguments = listOf(
                navArgument("specialty") { type = NavType.StringType; defaultValue = "" },
                navArgument("kid") { type = NavType.StringType; defaultValue = "" },
            ),
        ) { backStack ->
            val appointments by appViewModel.uiState.selectAsState { it.appointments }
            val bookingCity by appViewModel.uiState.selectAsState { it.bookingCity }
            val bookingDirectory by appViewModel.uiState.selectAsState { it.bookingDirectory }
            val doctors by appViewModel.uiState.selectAsState { it.doctors }
            val kids by appViewModel.uiState.selectAsState { it.kids }
            val locationEnabled by appViewModel.uiState.selectAsState { it.locationEnabled }
            val bookingSlotsMap by bookingViewModel.bookingSlots.collectAsState()
            val ctx = LocalContext.current
            val booking by bookingViewModel.booking.collectAsState()
            val outcome by bookingViewModel.lastBooking.collectAsState()
            // Leaving the screen clears the last result, so re-opening it does
            // not greet the parent with a confirmation from ten minutes ago.
            DisposableEffect(Unit) { onDispose { bookingViewModel.clearBookingOutcome() } }
            // What the school check-up referred these children for, so the
            // screen can steer rather than present the whole directory.
            val referralTargets by guardianViewModel.referralTargets.collectAsState()
            LaunchedEffect(Unit) { guardianViewModel.loadReferralTargets() }
            BookingScreen(
                initialSpecialty = backStack.arguments?.getString("specialty").orEmpty(),
                initialKidName = backStack.arguments?.getString("kid").orEmpty(),
                directory = bookingDirectory,
                doctors = doctors,
                kids = kids,
                appointments = appointments,
                bookingCity = bookingCity,
                locationEnabled = locationEnabled,
                onBack = { navController.popBackStack() },
                onCityChange = { bookingViewModel.refreshBookingDirectory(it) },
                onUseMyLocation = { bookingViewModel.fetchLocationAndRefresh(ctx) },
                bookingSlotsByDoctor = bookingSlotsMap,
                onLoadSlots = { bookingViewModel.loadBookingSlots(it) },
                onConfirm = { doctor, kidName, date, time ->
                    bookingViewModel.bookAppointment(doctor, kidName, date, time)
                },
                onCancel = { bookingViewModel.cancelAppointment(it) },
                referrals = referralTargets,
                booking = booking,
                confirmed = outcome is BookingViewModel.BookingOutcome.Confirmed,
                refusedMessage = (outcome as? BookingViewModel.BookingOutcome.Refused)?.message,
            )
        }

        composable(Routes.HOSPITALS) {
            val bookingCity by appViewModel.uiState.selectAsState { it.bookingCity }
            val bookingDirectory by appViewModel.uiState.selectAsState { it.bookingDirectory }
            val locationEnabled by appViewModel.uiState.selectAsState { it.locationEnabled }
            val ctx = LocalContext.current
            LaunchedEffect(Unit) {
                if (bookingDirectory == null) {
                    bookingViewModel.refreshBookingDirectory()
                }
            }
            HospitalsScreen(
                directory = bookingDirectory,
                bookingCity = bookingCity,
                locationEnabled = locationEnabled,
                onBack = { navController.popBackStack() },
                onCityChange = { bookingViewModel.refreshBookingDirectory(it) },
                onUseMyLocation = { bookingViewModel.fetchLocationAndRefresh(ctx) },
                onBookAppointment = { navController.navigate(bookingRoute()) },
            )
        }

        // ── The school screening pathway, as a guardian sees it ──

        composable(Routes.CAMP_CONSENT) {
            CampConsentScreen(
                guardianViewModel = guardianViewModel,
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            Routes.CAMP_RESULT,
            arguments = listOf(
                navArgument("campId") { type = NavType.StringType },
                navArgument("kidId") { type = NavType.StringType },
            )
        ) { backStack ->
            CampResultScreen(
                campId = backStack.arguments?.getString("campId").orEmpty(),
                kidId = backStack.arguments?.getString("kidId").orEmpty(),
                guardianViewModel = guardianViewModel,
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.REFERRALS) {
            ReferralsScreen(
                guardianViewModel = guardianViewModel,
                onFindDoctor = { specialty, kidName ->
                    navController.navigate(bookingRoute(specialty, kidName))
                },
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.QUESTIONS) {
            QuestionsScreen(
                kids = kids,
                guardianViewModel = guardianViewModel,
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.LIBRARY) {
            LibraryScreen(
                guardianViewModel = guardianViewModel,
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.RECORD) {
            PrivacyScreen(
                kids = kids,
                guardianViewModel = guardianViewModel,
                onBack = { navController.popBackStack() },
                onErased = { kidsViewModel.forgetKidLocally(it) },
            )
        }

        composable(
            Routes.SYMPTOMS,
            arguments = listOf(navArgument("kidId") { type = NavType.StringType })
        ) { backStack ->
            val id = backStack.arguments?.getString("kidId").orEmpty()
            SymptomScreen(
                kidId = id,
                kidName = kidsViewModel.kidById(id)?.name.orEmpty(),
                guardianViewModel = guardianViewModel,
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.NOTIFICATIONS) {
            val notifications by appViewModel.uiState.selectAsState { it.notifications }
            NotificationsScreen(
                notifications = notifications,
                onBack = {
                    profileViewModel.markAllNotificationsRead()
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.SCHOOLS) {
            val availableSchools by appViewModel.uiState.selectAsState { it.availableSchools }
            val kids by appViewModel.uiState.selectAsState { it.kids }
            val partnerSchools by appViewModel.uiState.selectAsState { it.partnerSchools }
            SchoolsScreen(
                partnerSchools = partnerSchools,
                availableSchools = availableSchools,
                kids = kids,
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            Routes.CAMP_DETAIL,
            arguments = listOf(navArgument("campId") { type = NavType.StringType })
        ) { backStack ->
            val campId = backStack.arguments?.getString("campId").orEmpty()
            val camp = campsViewModel.campById(campId)
            val kids by appViewModel.uiState.selectAsState { it.kids }
            if (camp != null) {
                CampDetailScreen(
                    camp = camp,
                    kids = kids,
                    onBack = { navController.popBackStack() },
                    onBookFollowUp = { navController.navigate(bookingRoute()) },
                    onOpenResult = { campId, kidId ->
                        navController.navigate("campResult/$campId/$kidId")
                    },
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
            val coParents by appViewModel.uiState.selectAsState { it.coParents }
            val familyCode by appViewModel.uiState.selectAsState { it.familyCode }
            val familyBusy by profileViewModel.familyBusy.collectAsState()
            FamilySharingScreen(
                familyCode = familyCode,
                coParents = coParents,
                onBack = { navController.popBackStack() },
                onJoinFamily = { profileViewModel.joinFamily(it, kidsViewModel) },
                onGenerateCode = { profileViewModel.generateFamilyCode() },
                onShareCode = {
                    val code = familyCode
                    val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(android.content.Intent.EXTRA_TEXT, "Join me on VitaHero! Use family code: $code")
                        putExtra(android.content.Intent.EXTRA_SUBJECT, "VitaHero Family Sharing")
                    }
                    navController.context.startActivity(android.content.Intent.createChooser(intent, "Share family code"))
                },
                busy = familyBusy,
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
