package com.rork.vitahero.data

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf

enum class AppLocale(val code: String, val label: String) {
    ENGLISH("en", "English"),
    HINDI("hi", "\u0939\u093F\u0928\u094D\u0926\u0940"),       // हिन्दी
    TELUGU("te", "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41")     // తెలుగు
}

val LocalAppLocale = compositionLocalOf { AppLocale.ENGLISH }

/** All user-facing strings with translations. */
object S {
    // ---- Onboarding ----
    const val onboardingTitle1 = "onboarding_title_1"
    const val onboardingSub1 = "onboarding_sub_1"
    const val onboardingTitle2 = "onboarding_title_2"
    const val onboardingSub2 = "onboarding_sub_2"
    const val onboardingTitle3 = "onboarding_title_3"
    const val onboardingSub3 = "onboarding_sub_3"
    const val onboardingTitle4 = "onboarding_title_4"
    const val onboardingSub4 = "onboarding_sub_4"
    const val getStarted = "get_started"
    const val createAccount = "create_account"
    const val skip = "skip"
    const val next = "next"

    // ---- Auth ----
    const val loginSignup = "login_signup"
    const val loginTab = "login_tab"
    const val signupTab = "signup_tab"
    const val phoneLabel = "phone_label"
    const val phonePlaceholder = "phone_placeholder"
    const val yourName = "your_name"
    const val namePlaceholder = "name_placeholder"
    const val continueBtn = "continue_btn"
    const val otpTitle = "otp_title"
    const val otpSubtitle = "otp_subtitle"
    const val verify = "verify"
    const val resend = "resend"
    const val trustBadge = "trust_badge"
    const val emailLabel = "email_label"
    const val passwordLabel = "password_label"
    const val emailPlaceholder = "email_placeholder"
    const val passwordPlaceholder = "password_placeholder"
    const val namePlaceholderAuth = "name_placeholder_auth"
    const val phoneTab = "phone_tab"
    const val emailTab = "email_tab"
    const val pleaseWait = "please_wait"
    const val sendOtp = "send_otp"
    const val useEmail = "use_email"
    const val usePhone = "use_phone"
    const val signUpHint = "sign_up_hint"
    const val loginHint = "login_hint"
    const val emailConfirmNote = "email_confirm_note"
    const val smsNote = "sms_note"
    const val signInWithGoogle = "sign_in_with_google"

    // ---- Consent ----
    const val consentTitle = "consent_title"
    const val consentBody = "consent_body"
    const val consentAccept = "consent_accept"
    const val consentDecline = "consent_decline"

    // ---- Home ----
    const val goodMorning = "good_morning"
    const val hiName = "hi_name"
    const val yourKids = "your_kids"
    const val dietPlan = "diet_plan"
    const val bookVisit = "book_visit"
    const val badges = "badges"
    const val upcomingCamp = "upcoming_camp"
    const val allCamps = "all_camps"
    const val upcomingAppts = "upcoming_appts"
    const val healthScore = "health_score"
    const val growthOnTrack = "growth_on_track"
    const val doingWell = "doing_well"
    const val viewDetails = "view_details"

    // ---- Kids ----
    const val myKids = "my_kids"
    const val addChild = "add_child"
    const val kidName = "kid_name"
    const val kidAge = "kid_age"
    const val kidGender = "kid_gender"
    const val kidSchool = "kid_school"
    const val kidGrade = "kid_grade"
    const val kidHeight = "kid_height"
    const val kidWeight = "kid_weight"
    const val saveKid = "save_kid"
    const val boy = "boy"
    const val girl = "girl"

    // ---- Kid Detail ----
    const val growthTab = "growth_tab"
    const val dentalTab = "dental_tab"
    const val eyeTab = "eye_tab"
    const val nutritionTab = "nutrition_tab"
    const val heightLabel = "height_label"
    const val weightLabel = "weight_label"
    const val bmiLabel = "bmi_label"
    const val logMeasurements = "log_measurements"
    const val newMeasurement = "new_measurement"
    const val heightTrend = "height_trend"
    const val weightTrend = "weight_trend"
    const val shareReport = "share_report"
    const val generatingReport = "generating_report"
    const val saveMeasurements = "save_measurements"
    const val viewDietPlan = "view_diet_plan"
    const val dentalGoodMsg = "dental_good_msg"
    const val dentalWatchMsg = "dental_watch_msg"
    const val eyeGoodMsg = "eye_good_msg"
    const val eyeWatchMsg = "eye_watch_msg"
    const val disclaimerShort = "disclaimer_short"
    const val disclaimerChart = "disclaimer_chart"

    // ---- Diet ----
    const val todaysPlan = "todays_plan"
    const val kcalLogged = "kcal_logged"
    const val allMealsLogged = "all_meals_logged"
    const val logAllMealsHint = "log_all_meals_hint"
    const val todaysMeals = "todays_meals"
    const val aiDietCoach = "ai_diet_coach"
    const val aiSubtitle = "ai_subtitle"
    const val generateTips = "generate_tips"
    const val analyzing = "analyzing"
    const val craftingTips = "crafting_tips"
    const val refreshTips = "refresh_tips"
    const val whyMatters = "why_matters"
    const val tryToday = "try_today"
    const val funFact = "fun_fact"
    const val recognizeFood = "recognize_food"

    // ---- Camps ----
    const val schoolCamps = "school_camps"
    const val bookFollowUp = "book_follow_up"
    const val screened = "screened"
    const val upcoming = "upcoming"
    const val completed = "completed"

    // ---- Rewards ----
    const val heroBadges = "hero_badges"
    const val leaderboard = "leaderboard"
    const val earned = "earned"
    const val points = "points"

    // ---- Profile ----
    const val linkedChildren = "linked_children"
    const val pushNotif = "push_notif"
    const val campReminders = "camp_reminders"
    const val notifSubtitle = "notif_subtitle"
    const val campReminderSub = "camp_reminder_sub"
    const val linkedHospitals = "linked_hospitals"
    const val hospitalPartnersSub = "hospital_partners_sub"
    const val familySharing = "family_sharing"
    const val privacyData = "privacy_data"
    const val helpSupport = "help_support"
    const val darkMode = "dark_mode"
    const val darkModeSub = "dark_mode_sub"
    const val language = "language"
    const val logout = "logout"
    const val more = "more"
    const val notifications = "notifications"

    // ---- Family Sharing ----
    const val familyTitle = "family_title"
    const val familySubtitle = "family_subtitle"
    const val yourFamilyCode = "your_family_code"
    const val enterFamilyCode = "enter_family_code"
    const val joinFamily = "join_family"
    const val familyCodePlaceholder = "family_code_placeholder"
    const val shareYourCode = "share_your_code"

    // ---- Notifications ----
    const val notifCenter = "notif_center"

    // ---- Food Recognition ----
    const val foodRecTitle = "food_rec_title"
    const val foodRecSub = "food_rec_sub"
    const val captureFood = "capture_food"
    const val analyzingFood = "analyzing_food"
    const val detectedFood = "detected_food"
    const val logAsMeal = "log_as_meal"
    const val noFoodDetected = "no_food_detected"

    // ---- Booking ----
    const val bookAppt = "book_appt"
    const val selectDoctor = "select_doctor"
    const val selectHospital = "select_hospital"
    const val hospitalsNearYou = "hospitals_near_you"
    const val campPartnerHospital = "camp_partner_hospital"
    const val conductedCampsCount = "conducted_camps_count"
    const val viewByHospital = "view_by_hospital"
    const val viewBySpecialty = "view_by_specialty"
    const val yourArea = "your_area"
    const val noHospitalsFound = "no_hospitals_found"
    const val kmAway = "km_away"
    const val useMyLocation = "use_my_location"
    const val locationSorted = "location_sorted"
    const val noSlotsAvailable = "no_slots_available"
    const val selectKid = "select_kid"
    const val selectDate = "select_date"
    const val selectTime = "select_time"
    const val confirmBooking = "confirm_booking"
    const val cancelAppt = "cancel_appt"
    const val yourAppts = "your_appts"

    // ---- Common ----
    const val disclaimer = "disclaimer"
    const val version = "version"
    const val back = "back"
    const val save = "save"
    const val cancel = "cancel"
    const val ok = "ok"

    // ---- Wearable ----
    const val wearableTitle = "wearable_title"
    const val wearableSub = "wearable_sub"
    const val connectHealth = "connect_health"
    const val stepsToday = "steps_today"
    const val activeMinutes = "active_minutes"
    const val syncedFrom = "synced_from"
    const val healthConnectInstall = "health_connect_install"

    // ---- Kid management ----
    const val deleteKid = "delete_kid"
    const val deleteKidConfirm = "delete_kid_confirm"
    const val deleteKidBody = "delete_kid_body"

    // ---- School partnerships ----
    const val schoolPartners = "school_partners"
    const val schoolPartnersSub = "school_partners_sub"
    const val linkedSchools = "linked_schools"
    const val enterPartnerCode = "enter_partner_code"
    const val partnerCodeHint = "partner_code_hint"
    const val linkChildOptional = "link_child_optional"
    const val linkSchool = "link_school"
    const val partnerSchoolsList = "partner_schools_list"
    const val linked = "linked"
    const val schoolLinked = "school_linked"
    const val schoolEnrollFailed = "school_enroll_failed"
    const val campRegistered = "camp_registered"
    const val campRegisterFailed = "camp_register_failed"
    const val campDetails = "camp_details"
    const val partnerCamp = "partner_camp"
    const val eligibleGrades = "eligible_grades"
    const val screeningsIncluded = "screenings_included"
    const val capacity = "capacity"
    const val registerChild = "register_child"
    const val registered = "registered"
    const val selected = "selected"
    const val confirmRegistration = "confirm_registration"
    const val linkSchoolPartners = "link_school_partners"
    const val openSchools = "open_schools"

    // ---- Clinical growth charts ----
    const val clinicalGrowthCharts = "clinical_growth_charts"
    const val growthChartsFor = "growth_charts_for"
    const val currentAssessment = "current_assessment"
    const val heightPercentile = "height_percentile"
    const val weightPercentile = "weight_percentile"
    const val bmiPercentile = "bmi_percentile"
    const val referenceStandard = "reference_standard"
    const val heightChart = "height_chart"
    const val weightChart = "weight_chart"
    const val bmiChart = "bmi_chart"
    const val yourChild = "your_child"
    const val growthChartDisclaimer = "growth_chart_disclaimer"
    const val viewClinicalCharts = "view_clinical_charts"

    const val verifyNumber = "verify_number"
    const val didntGetCode = "didnt_get_code"
    const val resendIn = "resend_in"
    const val orContinue = "or_continue"
    const val weWillSendCode = "we_will_send_code"
    const val appSubtitle = "app_subtitle"
    const val addPhotoOptional = "add_photo_optional"
    const val addAnotherChild = "add_another_child"
    const val trackAllKids = "track_all_kids"
    const val childrenTracked = "children_tracked"
    const val childTracked = "child_tracked"
    const val schoolScreenings = "school_screenings"
    const val noCampsYet = "no_camps_yet"
    const val noCampsSub = "no_camps_sub"
    const val pastCamps = "past_camps"
    const val addToReminders = "add_to_reminders"
    const val appearance = "appearance"
    const val inviteCoParent = "invite_co_parent"
    const val linkedHospitalsValue = "linked_hospitals_value"
    const val coParentsSection = "co_parents_section"
    const val askForCode = "ask_for_code"
    const val familyInfo = "family_info"
    const val growthTabLabel = "growth_tab_label"
    const val dentalTabLabel = "dental_tab_label"
    const val eyeTabLabel = "eye_tab_label"
    const val nutritionTabLabel = "nutrition_tab_label"
    const val dietStatus = "diet_status"
    const val dietSubtitle = "diet_subtitle"
    const val balancedDietMsg = "balanced_diet_msg"
    const val notMeasuredMsg = "not_measured_msg"
    const val ironLowMsg = "iron_low_msg"
    const val activityData = "activity_data"
    const val notConnected = "not_connected"
    const val stepsMin = "steps_min"
    const val consentSubtitle = "consent_subtitle"
    const val consentItem1Title = "consent_item_1_title"
    const val consentItem1Desc = "consent_item_1_desc"
    const val consentItem2Title = "consent_item_2_title"
    const val consentItem2Desc = "consent_item_2_desc"
    const val consentItem3Title = "consent_item_3_title"
    const val consentItem3Desc = "consent_item_3_desc"
    const val learnPrivacy = "learn_privacy"
    const val apptConfirmed = "appt_confirmed"
    const val done = "done"
    const val noDoctorsFound = "no_doctors_found"
    const val heroBadgesTitle = "hero_badges_title"
    const val heroBadgesSub = "hero_badges_sub"
    const val risingHero = "rising_hero"
    const val kidBadges = "kid_badges"
    const val classLeaderboard = "class_leaderboard"
    const val anonymized = "anonymized"
    const val captureMeal = "capture_meal"
    const val pointCamera = "point_camera"
    const val detectedItems = "detected_items"
    const val tapAgain = "tap_again"
    const val detectedFoodTitle = "detected_food_title"
    const val foodRecTip = "food_rec_tip"
    const val analyzingPhoto = "analyzing_photo"
    const val identifyingFood = "identifying_food"
    const val takePhotoOf = "take_photo_of"
    const val logBtn = "log_btn"
    const val percentMatch = "percent_match"
    const val foodSubtitleLong = "food_subtitle_long"
    const val allCaughtUp = "all_caught_up"
    const val allCaughtUpSub = "all_caught_up_sub"
    const val noKidsYet = "no_kids_yet"
    const val noKidsSub = "no_kids_sub"
    const val addFirstChild = "add_first_child"

    // ---- Errors & sync ----
    const val syncFailed = "sync_failed"
    const val authGoogleFailed = "auth_google_failed"
    const val authSignupFailed = "auth_signup_failed"
    const val authSigninFailed = "auth_signin_failed"
    const val authMissingToken = "auth_missing_token"
    const val authOtpSendFailed = "auth_otp_send_failed"
    const val authOtpInvalid = "auth_otp_invalid"
    const val familyInvalid = "family_invalid"
    const val coParentRelation = "co_parent_relation"
    const val noFamilyCodeYet = "no_family_code_yet"
    const val generateFamilyCode = "generate_family_code"
    const val linkedHospitalsSub = "linked_hospitals_sub"
    const val privacyDataSub = "privacy_data_sub"
    const val helpSupportSub = "help_support_sub"

    // ── The school screening pathway, as a guardian sees it ──
    // Consent (including the separate photography question), the released
    // result, follow-up, questions to the school, reading, and data rights.
    const val backLabel = "back_label"
    const val closeLabel = "close_label"
    const val cancelLabel = "cancel_label"
    const val viewLabel = "view_label"
    const val loadingLabel = "loading_label"
    const val you = "you_label"
    const val theSchool = "the_school_label"
    const val campConsentTitle = "camp_consent_title"
    const val campConsentSub = "camp_consent_sub"
    const val noConsentPending = "no_consent_pending"
    const val noConsentPendingSub = "no_consent_pending_sub"
    const val consentChecksTitle = "consent_checks_title"
    const val consentChecksHint = "consent_checks_hint"
    const val consentGrant = "consent_grant"
    const val campConsentDecline = "camp_consent_decline"
    const val consentDeadlineMsg = "consent_deadline_msg"
    const val consentChangeMind = "consent_change_mind"
    const val consentRecordedYes = "consent_recorded_yes"
    const val consentRecordedNo = "consent_recorded_no"
    const val consentFailed = "consent_failed"
    const val photoConsentTitle = "photo_consent_title"
    const val photoConsentBody = "photo_consent_body"
    const val photoConsentAgree = "photo_consent_agree"
    const val campResultTitle = "camp_result_title"
    const val resultUnderReview = "result_under_review"
    const val resultUnderReviewSub = "result_under_review_sub"
    const val doctorSays = "doctor_says"
    const val photosTitle = "photos_title"
    const val photosSub = "photos_sub"
    const val photoUnavailable = "photo_unavailable"
    const val questionsTitle = "questions_title"
    const val questionsSub = "questions_sub"
    const val questionsClosed = "questions_closed"
    const val questionsClosedSub = "questions_closed_sub"
    const val questionsNoticeFallback = "questions_notice_fallback"
    const val yourQuestions = "your_questions"
    const val askTheSchool = "ask_the_school"
    const val replyWithinDays = "reply_within_days"
    const val aboutWhichChild = "about_which_child"
    const val questionPlaceholder = "question_placeholder"
    const val notUrgentAck = "not_urgent_ack"
    const val sendQuestion = "send_question"
    const val awaitingSchool = "awaiting_school"
    const val schoolReplied = "school_replied"
    const val questionSentMsg = "question_sent_msg"
    const val questionFailed = "question_failed"
    const val libraryTitle = "library_title"
    const val librarySub = "library_sub"
    const val forYourFamily = "for_your_family"
    const val generalReading = "general_reading"
    const val becauseOfFinding = "because_of_finding"
    const val libraryEmpty = "library_empty"
    const val libraryDisclaimer = "library_disclaimer"
    const val referralsTitle = "referrals_title"
    const val referralsSub = "referrals_sub"
    const val noReferrals = "no_referrals"
    const val noReferralsSub = "no_referrals_sub"
    const val referralDueBy = "referral_due_by"
    const val referralBooked = "referral_booked"
    const val referralAttended = "referral_attended"
    const val referralNotGoing = "referral_not_going"
    const val referralClosed = "referral_closed"
    const val referralUpdateFailed = "referral_update_failed"
    const val urgencyUrgent = "urgency_urgent"
    const val urgencySoon = "urgency_soon"
    const val urgencyRoutine = "urgency_routine"
    const val privacyTitle = "privacy_rights_title"
    const val privacySub = "privacy_rights_sub"
    const val careIsFreeTitle = "care_is_free_title"
    const val careIsFreeBody = "care_is_free_body"
    const val withdrawTitle = "withdraw_title"
    const val withdrawBody = "withdraw_body"
    const val withdrawAction = "withdraw_action"
    const val withdrawReasonHint = "withdraw_reason_hint"
    const val withdrawConfirm = "withdraw_confirm"
    const val consentWithdrawn = "consent_withdrawn"
    const val consentWithdrawFailed = "consent_withdraw_failed"
    const val rightsHistoryTitle = "rights_history_title"
    const val rightsHistorySub = "rights_history_sub"
    const val correctionSent = "correction_sent"
    const val correctionFailed = "correction_failed"
    const val todayLabel = "today_label"
    const val tomorrowLabel = "tomorrow_label"
}

private val en = mapOf(
    S.dentalGoodMsg to "No cavities were found at the last check. Keep brushing twice a day.",
    S.dentalWatchMsg to "Some plaque was noted. A dental follow-up within 2 weeks is recommended.",
    S.eyeGoodMsg to "Vision is normal (6/6). No correction needed.",
    S.eyeWatchMsg to "Mild eye strain was noted. Consider a follow-up with an eye specialist.",
    S.disclaimerChart to "Charts are for information only. Always consult a doctor for medical decisions.",
    S.disclaimerShort to "For information only. Consult a doctor for a diagnosis.",
    S.risingHero to "%s is a rising hero!",
    S.notMeasuredMsg to "This check has not been done yet. It will appear here after your child\u2019s next school health camp.",
    S.onboardingTitle1 to "Track Your Kid's Growth Heroically!",
    S.onboardingSub1 to "School camps, diet plans, doctor support & rewards — all in one place.",
    S.onboardingTitle2 to "Free School Health Camps",
    S.onboardingSub2 to "Identify growth, dental, and eye issues early with regular school screenings.",
    S.onboardingTitle3 to "All Your Kids in One Place",
    S.onboardingSub3 to "Personalized diet plans, progress tracking & hero badges for every child.",
    S.onboardingTitle4 to "Your Kid's Health Companion",
    S.onboardingSub4 to "AI-powered diet tips, appointment booking, and shareable health reports.",
    S.getStarted to "Get Started",
    S.createAccount to "Create Account",
    S.skip to "Skip",
    S.next to "Next",
    S.loginSignup to "Login / Sign Up",
    S.loginTab to "Login",
    S.signupTab to "Sign Up",
    S.phoneLabel to "Phone Number",
    S.phonePlaceholder to "Enter your phone number",
    S.yourName to "Your Name",
    S.namePlaceholder to "Enter your name",
    S.continueBtn to "Continue",
    S.otpTitle to "Verify Phone",
    S.otpSubtitle to "Enter the 6-digit code sent to",
    S.verify to "Verify",
    S.resend to "Resend code",
    S.trustBadge to "Your data is secure & private. DPDP compliant.",
    S.emailLabel to "Email",
    S.passwordLabel to "Password",
    S.emailPlaceholder to "parent@example.com",
    S.passwordPlaceholder to "Min 6 characters",
    S.namePlaceholderAuth to "e.g. Priya Sharma",
    S.phoneTab to "Phone",
    S.emailTab to "Email",
    S.pleaseWait to "Please wait…",
    S.sendOtp to "Send OTP",
    S.useEmail to "Use Email",
    S.usePhone to "Use Phone",
    S.signUpHint to "New? Sign Up",
    S.loginHint to "Have account?",
    S.emailConfirmNote to "We'll send a confirmation to your email",
    S.smsNote to "We'll send a 6-digit code via SMS",
    S.signInWithGoogle to "Sign in with Google",
    S.consentTitle to "Parental Consent",
    S.consentBody to "VitaHero collects your child's health data (height, weight, dental, eyesight, nutrition) to provide personalized insights and recommendations. This data is stored securely and never shared without your permission. You can delete it anytime.",
    S.consentAccept to "I Agree — Continue",
    S.consentDecline to "Not now",
    S.goodMorning to "Good morning,",
    S.hiName to "Hi %s",
    S.yourKids to "Your kids",
    S.dietPlan to "Diet plan",
    S.bookVisit to "Book visit",
    S.badges to "Badges",
    S.upcomingCamp to "Upcoming camp",
    S.allCamps to "All camps",
    S.upcomingAppts to "Upcoming appointments",
    S.healthScore to "Health score",
    S.growthOnTrack to "Growth on track",
    S.doingWell to "Doing well",
    S.viewDetails to "View details",
    S.myKids to "My Kids",
    S.addChild to "Add a child",
    S.kidName to "Child's name",
    S.kidAge to "Age (years)",
    S.kidGender to "Gender",
    S.kidSchool to "School name",
    S.kidGrade to "Class / Grade",
    S.kidHeight to "Height (cm)",
    S.kidWeight to "Weight (kg)",
    S.saveKid to "Save child profile",
    S.boy to "Boy",
    S.girl to "Girl",
    S.growthTab to "Growth",
    S.dentalTab to "Dental",
    S.eyeTab to "Eyesight",
    S.nutritionTab to "Nutrition",
    S.heightLabel to "Height",
    S.weightLabel to "Weight",
    S.bmiLabel to "BMI",
    S.logMeasurements to "Log new measurements",
    S.newMeasurement to "New measurement",
    S.heightTrend to "Height trend",
    S.weightTrend to "Weight trend",
    S.shareReport to "Share Report",
    S.generatingReport to "Generating PDF report…",
    S.saveMeasurements to "Save measurements",
    S.viewDietPlan to "View today's diet plan",
    S.todaysPlan to "Today's plan",
    S.kcalLogged to "%d of %d kcal logged",
    S.allMealsLogged to "All meals logged — Super Eater streak continues!",
    S.logAllMealsHint to "Log all meals to earn the Super Eater badge",
    S.todaysMeals to "Today's meals",
    S.aiDietCoach to "AI Diet Coach",
    S.aiSubtitle to "Personalised tips powered by AI",
    S.generateTips to "Generate Personalised Diet Tips",
    S.analyzing to "Analysing %s's data…",
    S.craftingTips to "Crafting personalised recommendations",
    S.refreshTips to "Refresh tips",
    S.whyMatters to "Why this matters",
    S.tryToday to "Try this today",
    S.funFact to "Fun fact",
    S.recognizeFood to "Recognize food",
    S.schoolCamps to "School Health Camps",
    S.bookFollowUp to "Book Follow-up",
    S.screened to "screened",
    S.upcoming to "Upcoming",
    S.completed to "Completed",
    S.heroBadges to "Hero Badges",
    S.leaderboard to "Leaderboard",
    S.earned to "Earned",
    S.points to "pts",
    S.linkedChildren to "Linked children",
    S.pushNotif to "Push notifications",
    S.campReminders to "Camp reminders",
    S.notifSubtitle to "Camp, checkup & diet reminders",
    S.campReminderSub to "Get notified before school camps",
    S.linkedHospitals to "Linked hospitals",
    S.familySharing to "Family sharing",
    S.privacyData to "Privacy & data",
    S.helpSupport to "Help & support",
    S.darkMode to "Dark mode",
    S.darkModeSub to "Switch between light and dark theme",
    S.language to "Language",
    S.logout to "Log out",
    S.more to "More",
    S.notifications to "Notifications",
    S.familyTitle to "Family Sharing",
    S.familySubtitle to "Invite a co-parent or guardian to track your kids together",
    S.yourFamilyCode to "Your Family Code",
    S.enterFamilyCode to "Join a Family",
    S.joinFamily to "Join Family",
    S.familyCodePlaceholder to "Enter family code",
    S.shareYourCode to "Share this code with your co-parent",
    S.notifCenter to "Notification Center",
    S.foodRecTitle to "Food Recognition",
    S.foodRecSub to "Take a photo of your child's meal to log it instantly",
    S.captureFood to "Capture Meal",
    S.analyzingFood to "Analyzing your photo…",
    S.detectedFood to "Detected food items",
    S.logAsMeal to "Log as meal",
    S.noFoodDetected to "No food items detected. Try a clearer photo.",
    S.bookAppt to "Book Appointment",
    S.selectDoctor to "Select a doctor",
    S.selectHospital to "Select a hospital",
    S.hospitalsNearYou to "Hospitals in your area",
    S.campPartnerHospital to "Camp partner",
    S.conductedCampsCount to "%d school camps conducted",
    S.viewByHospital to "By hospital",
    S.viewBySpecialty to "By specialty",
    S.yourArea to "Your area",
    S.noHospitalsFound to "No hospitals found in this area",
    S.kmAway to "%s km away",
    S.useMyLocation to "Use my location",
    S.locationSorted to "Sorted by distance from you",
    S.hospitalPartnersSub to "Partner hospitals near you — camp partners shown first",
    S.noSlotsAvailable to "No open slots for this doctor. Try another date or doctor.",
    S.selectKid to "For which child?",
    S.selectDate to "Select date",
    S.selectTime to "Select time slot",
    S.confirmBooking to "Confirm Booking",
    S.cancelAppt to "Cancel appointment",
    S.yourAppts to "Your appointments",
    S.disclaimer to "For informational purposes only. Always consult a doctor for medical advice.",
    S.version to "VitaHero v1.0 · For informational purposes only.\nAlways consult a doctor for medical advice.",
    S.back to "Back",
    S.save to "Save",
    S.cancel to "Cancel",
    S.ok to "OK",
    S.wearableTitle to "Health Connect",
    S.wearableSub to "Sync step count and activity data from your child's device",
    S.connectHealth to "Connect Health Data",
    S.stepsToday to "Steps today",
    S.activeMinutes to "Active minutes",
    S.syncedFrom to "Synced from device",
    S.healthConnectInstall to "Install Health Connect from Play Store to sync activity data.",
    S.deleteKid to "Remove child",
    S.deleteKidConfirm to "Remove this child?",
    S.deleteKidBody to "All meals, streaks, and growth data for this child will be permanently deleted.",
    S.schoolPartners to "School Partners",
    S.schoolPartnersSub to "Link your child's school to receive real health camp schedules",
    S.linkedSchools to "Your linked schools",
    S.enterPartnerCode to "Enter partner code",
    S.partnerCodeHint to "Ask your school nurse for the VitaHero partner code (e.g. OAK2026).",
    S.linkChildOptional to "Link a child (optional)",
    S.linkSchool to "Link school",
    S.partnerSchoolsList to "Partner schools in Hyderabad",
    S.linked to "Linked",
    S.schoolLinked to "Connected to %s. Partner camps are now in your Camps tab.",
    S.schoolEnrollFailed to "Could not link school. Check the partner code.",
    S.campRegistered to "Camp registration confirmed! A reminder will appear before the camp.",
    S.campRegisterFailed to "Registration failed. Enroll with your school first.",
    S.campDetails to "Camp details",
    S.partnerCamp to "Verified school camp",
    S.eligibleGrades to "Eligible grades",
    S.screeningsIncluded to "Screenings included",
    S.capacity to "Capacity",
    S.registerChild to "Register your child",
    S.registered to "Registered",
    S.selected to "Selected",
    S.confirmRegistration to "Confirm registration",
    S.linkSchoolPartners to "Link school partner",
    S.openSchools to "School partners",
    S.clinicalGrowthCharts to "Clinical growth charts",
    S.growthChartsFor to "WHO/IAP charts for %s",
    S.currentAssessment to "Current assessment",
    S.heightPercentile to "Height percentile",
    S.weightPercentile to "Weight percentile",
    S.bmiPercentile to "BMI percentile",
    S.referenceStandard to "Reference",
    S.heightChart to "Height",
    S.weightChart to "Weight",
    S.bmiChart to "BMI",
    S.yourChild to "Your child",
    S.growthChartDisclaimer to "Based on WHO 2007 growth references used by IAP. For clinical decisions, consult your paediatrician.",
    S.viewClinicalCharts to "View WHO/IAP percentile charts",
    S.verifyNumber to "Verify your number",
    S.didntGetCode to "Didn't get the code?",
    S.resendIn to "Resend in %ss",
    S.orContinue to "or continue with",
    S.weWillSendCode to "We'll send a 6-digit verification code to this number.",
    S.appSubtitle to "Your child's health, in heroic hands",
    S.addPhotoOptional to "Add a photo (optional)",
    S.addAnotherChild to "Add another child",
    S.trackAllKids to "Track all your kids in one place",
    S.childrenTracked to "%d children tracked",
    S.childTracked to "%d child tracked",
    S.schoolScreenings to "School screening camps & follow-ups",
    S.noCampsYet to "No camps yet",
    S.noCampsSub to "When your school schedules a health camp, it will appear here.",
    S.pastCamps to "Past camps",
    S.addToReminders to "Add to reminders",
    S.appearance to "Appearance",
    S.inviteCoParent to "Invite co-parent or guardian",
    S.linkedHospitalsValue to "Rainbow, LV Prasad, Apollo Cradle",
    S.coParentsSection to "Co-parents",
    S.askForCode to "Ask your co-parent to share their code",
    S.familyInfo to "All family members can view and manage kid profiles, health records, and appointments.",
    S.growthTabLabel to "Growth",
    S.dentalTabLabel to "Dental",
    S.eyeTabLabel to "Eyesight",
    S.nutritionTabLabel to "Nutrition",
    S.dietStatus to "Diet status",
    S.dietSubtitle to "Personalised by our dietician",
    S.balancedDietMsg to "Balanced diet with good protein and iron intake. Keep it up!",
    S.ironLowMsg to "Iron and protein intake is a little low. Add more dal, leafy greens and nuts.",
    S.activityData to "Activity data",
    S.notConnected to "Not connected",
    S.stepsMin to "%d steps · %d min active",
    S.consentSubtitle to "We follow strict data protection rules (DPDP Act 2023 compliant) to keep your family's health info private.",
    S.consentItem1Title to "Parental consent first",
    S.consentItem1Desc to "Only you can create and manage your child's profile.",
    S.consentItem2Title to "Encrypted & secure",
    S.consentItem2Desc to "All health records are stored with bank-level encryption.",
    S.consentItem3Title to "Anonymized insights",
    S.consentItem3Desc to "School leaderboards use anonymous IDs only.",
    S.learnPrivacy to "Learn more about privacy",
    S.apptConfirmed to "Appointment confirmed!",
    S.done to "Done",
    S.noDoctorsFound to "No doctors found",
    S.heroBadgesTitle to "Celebrate healthy habits & progress",
    S.heroBadgesSub to "%s is a rising hero! Keep going to unlock more.",
    S.kidBadges to "%s — Hero Badges",
    S.classLeaderboard to "Class leaderboard",
    S.anonymized to "Anonymized",
    S.captureMeal to "Capture Meal",
    S.pointCamera to "Point camera at your child's plate",
    S.detectedItems to "Detected %s items",
    S.tapAgain to "Tap to capture again",
    S.detectedFoodTitle to "Detected Food Items",
    S.foodRecTip to "Food recognition works best with clear, well-lit photos.",
    S.analyzingPhoto to "Analyzing your photo…",
    S.identifyingFood to "Identifying food items with AI",
    S.takePhotoOf to "Take a photo of %s's meal to log it instantly",
    S.logBtn to "Log",
    S.percentMatch to "~%s1 kcal · %s2%% match",
    S.foodSubtitleLong to "Food recognition works best with clear, well-lit photos.",
    S.allCaughtUp to "All caught up",
    S.allCaughtUpSub to "You'll see camp updates, checkup reminders, and reward alerts here.",
    S.noKidsYet to "No children yet",
    S.noKidsSub to "Add your first child to start tracking their health & growth.",
    S.addFirstChild to "Add a child",
    S.syncFailed to "Could not save your data. Please try again.",
    S.authGoogleFailed to "Google sign-in failed. Please try again.",
    S.authSignupFailed to "Sign up failed. Please check your details.",
    S.authSigninFailed to "Invalid email or password.",
    S.authMissingToken to "Sign-in incomplete. Please try again.",
    S.authOtpSendFailed to "Could not send OTP. Please try again.",
    S.authOtpInvalid to "Invalid OTP. Please try again.",
    S.familyInvalid to "Family code not found. Please check and try again.",
    S.coParentRelation to "Co-parent",
    S.noFamilyCodeYet to "Generate your family code to invite a co-parent.",
    S.generateFamilyCode to "Generate family code",
    S.linkedHospitalsSub to "Partner hospitals near you — camp partners shown first",
    S.privacyDataSub to "DPDP compliant · parental consent",
    S.helpSupportSub to "Email our support team",
    S.todayLabel to "Today",
    S.tomorrowLabel to "Tomorrow",
    S.backLabel to "Back",
    S.closeLabel to "Close",
    S.cancelLabel to "Cancel",
    S.viewLabel to "View",
    S.loadingLabel to "Loading\u2026",
    S.you to "You",
    S.theSchool to "The school",
    S.campConsentTitle to "Permission",
    S.campConsentSub to "The school is asking to check your child",
    S.noConsentPending to "Nothing to answer",
    S.noConsentPendingSub to "You have answered every request. We will tell you when the school asks again.",
    S.consentChecksTitle to "What will be checked",
    S.consentChecksHint to "Untick anything you do not want done. Your child will still get the rest.",
    S.consentGrant to "Yes, go ahead",
    S.campConsentDecline to "No, not this time",
    S.consentDeadlineMsg to "Please answer by %s.",
    S.consentChangeMind to "You can change your mind at any time, before or after the camp.",
    S.consentRecordedYes to "Thank you. Your permission is recorded.",
    S.consentRecordedNo to "Recorded. Your child will not be checked.",
    S.consentFailed to "We could not record that. Please try again.",
    S.photoConsentTitle to "Photographs",
    S.photoConsentBody to "At this camp the doctor may want to photograph something they find \u2014 a rash, or an eye. This is a separate question. You can say yes to the check-up and no to photographs.",
    S.photoConsentAgree to "Photographs are allowed",
    S.campResultTitle to "Camp result",
    S.resultUnderReview to "A doctor is still checking this",
    S.resultUnderReviewSub to "Nothing is shown until a doctor has read it. It will appear here when they are done.",
    S.doctorSays to "What the doctor advises",
    S.photosTitle to "Photographs",
    S.photosSub to "Taken because you allowed it. Only the camp's medical team and you can see these.",
    S.photoUnavailable to "This photograph could not be opened.",
    S.questionsTitle to "Ask the school",
    S.questionsSub to "About your child's health check-up",
    S.questionsClosed to "Not taking questions right now",
    S.questionsClosedSub to "Your school is not answering questions through the app at the moment. Please contact them directly.",
    S.questionsNoticeFallback to "This is for questions about your child's school health check-up. It is not watched all day and must not be used for anything urgent. If your child is unwell now, call your doctor or go to a hospital.",
    S.yourQuestions to "Your questions",
    S.askTheSchool to "Ask a question",
    S.replyWithinDays to "The school aims to reply within %s days.",
    S.aboutWhichChild to "About which child?",
    S.questionPlaceholder to "Type your question here",
    S.notUrgentAck to "I understand this is not for emergencies, and I will call a doctor if my child needs help now.",
    S.sendQuestion to "Send question",
    S.awaitingSchool to "Waiting for a reply",
    S.schoolReplied to "School replied",
    S.questionSentMsg to "Sent. The school aims to reply within %s days.",
    S.questionFailed to "We could not send that. Please try again.",
    S.libraryTitle to "Reading",
    S.librarySub to "Chosen from your own child's results",
    S.forYourFamily to "For your family",
    S.generalReading to "For everyone",
    S.becauseOfFinding to "Because of %s1's %s2 result",
    S.libraryEmpty to "Nothing to read yet",
    S.libraryDisclaimer to "General advice, not a diagnosis. If you are worried about your child, see a doctor.",
    S.referralsTitle to "Follow-up",
    S.referralsSub to "What to do after the camp",
    S.noReferrals to "Nothing to follow up",
    S.noReferralsSub to "No doctor has asked you to take your child anywhere.",
    S.referralDueBy to "Best done by %s.",
    S.referralBooked to "I have booked an appointment",
    S.referralAttended to "We went, and it is done",
    S.referralNotGoing to "We are not going to do this",
    S.referralClosed to "Closed",
    S.referralUpdateFailed to "We could not save that. Please try again.",
    S.urgencyUrgent to "Urgent",
    S.urgencySoon to "Soon",
    S.urgencyRoutine to "When you can",
    S.privacyTitle to "Your child's record",
    S.privacySub to "What is kept, and what you can do about it",
    S.careIsFreeTitle to "Health results are free",
    S.careIsFreeBody to "Your child's health results, follow-ups and records are free and always will be. A paid plan only adds convenience features.",
    S.withdrawTitle to "Withdraw from the school programme",
    S.withdrawBody to "Your child will not be screened at any future camp. Results already released stay in your app, and you can ask us to delete them at any time.",
    S.withdrawAction to "Withdraw",
    S.withdrawReasonHint to "Why? (optional)",
    S.withdrawConfirm to "Yes, withdraw",
    S.consentWithdrawn to "Withdrawn. Your child will not be screened again.",
    S.consentWithdrawFailed to "We could not do that. Please try again.",
    S.rightsHistoryTitle to "What has happened to this record",
    S.rightsHistorySub to "Every export, correction and withdrawal, in order.",
    S.correctionSent to "Sent to the school to check.",
    S.correctionFailed to "We could not send that. Please try again.",
)

private val hi = mapOf(
    S.dentalGoodMsg to "\u092A\u093F\u091B\u0932\u0940 \u091C\u093E\u0901\u091A \u092E\u0947\u0902 \u0915\u094B\u0908 \u0915\u0948\u0935\u093F\u091F\u0940 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u0940\u0964 \u0926\u093F\u0928 \u092E\u0947\u0902 \u0926\u094B \u092C\u093E\u0930 \u092C\u094D\u0930\u0936 \u0915\u0930\u0924\u0947 \u0930\u0939\u0947\u0902\u0964",
    S.dentalWatchMsg to "\u0925\u094B\u0921\u093C\u0940 \u092A\u094D\u0932\u0947\u0915 \u0926\u093F\u0916\u0940\u0964 2 \u0938\u092A\u094D\u0924\u093E\u0939 \u092E\u0947\u0902 \u0926\u093E\u0902\u0924\u094B\u0902 \u0915\u0940 \u091C\u093E\u0901\u091A \u0915\u0930\u093E\u090F\u0901\u0964",
    S.eyeGoodMsg to "\u0926\u0943\u0937\u094D\u091F\u093F \u0938\u093E\u092E\u093E\u0928\u094D\u092F \u0939\u0948 (6/6)\u0964 \u091A\u0936\u094D\u092E\u0947 \u0915\u0940 \u091C\u093C\u0930\u0942\u0930\u0924 \u0928\u0939\u0940\u0902\u0964",
    S.eyeWatchMsg to "\u0906\u0901\u0916\u094B\u0902 \u092A\u0930 \u0939\u0932\u094D\u0915\u093E \u091C\u093C\u094B\u0930 \u0926\u093F\u0916\u093E\u0964 \u0928\u0947\u0924\u094D\u0930 \u0935\u093F\u0936\u0947\u0937\u091C\u094D\u091E \u0938\u0947 \u091C\u093E\u0901\u091A \u0915\u0930\u093E\u090F\u0901\u0964",
    S.disclaimerChart to "\u091A\u093E\u0930\u094D\u091F \u0915\u0947\u0935\u0932 \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0915\u0947 \u0932\u093F\u090F \u0939\u0948\u0902\u0964 \u091A\u093F\u0915\u093F\u0924\u094D\u0938\u0940\u092F \u0928\u093F\u0930\u094D\u0923\u092F \u0915\u0947 \u0932\u093F\u090F \u0939\u092E\u0947\u0936\u093E \u0921\u0949\u0915\u094D\u091F\u0930 \u0938\u0947 \u092A\u0930\u093E\u092E\u0930\u094D\u0936 \u0915\u0930\u0947\u0902\u0964",
    S.disclaimerShort to "\u0915\u0947\u0935\u0932 \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0915\u0947 \u0932\u093F\u090F\u0964 \u0928\u093F\u0926\u093E\u0928 \u0915\u0947 \u0932\u093F\u090F \u0921\u0949\u0915\u094D\u091F\u0930 \u0938\u0947 \u092A\u0930\u093E\u092E\u0930\u094D\u0936 \u0915\u0930\u0947\u0902\u0964",
    S.risingHero to "%s \u090F\u0915 \u0909\u092D\u0930\u0924\u093E \u0939\u0940\u0930\u094B \u0939\u0948!",
    S.notMeasuredMsg to "\u092F\u0939 \u091C\u093E\u0901\u091A \u0905\u092D\u0940 \u0924\u0915 \u0928\u0939\u0940\u0902 \u0939\u0941\u0908 \u0939\u0948\u0964 \u0905\u0917\u0932\u0947 \u0938\u094D\u0915\u0942\u0932 \u0939\u0947\u0932\u094D\u0925 \u0915\u0948\u0902\u092A \u0915\u0947 \u092C\u093E\u0926 \u092F\u0939 \u092F\u0939\u093E\u0901 \u0926\u093F\u0916\u0947\u0917\u093E\u0964",
    S.onboardingTitle1 to "\u0905\u092A\u0928\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0940 \u0935\u0943\u0926\u094D\u0927\u093F \u0915\u094B \u091F\u094D\u0930\u0948\u0915 \u0915\u0930\u0947\u0902 \u0939\u0940\u0930\u094B \u0915\u0940 \u0924\u0930\u0939!",
    S.onboardingSub1 to "\u0938\u094D\u0915\u0942\u0932 \u0915\u0948\u0902\u092A, \u0921\u093E\u0907\u091F \u092A\u094D\u0932\u093E\u0928, \u0921\u0949\u0915\u094D\u091F\u0930 \u0938\u0939\u093E\u092F\u0924\u093E \u0914\u0930 \u0907\u0928\u093E\u092E — \u0938\u092C \u090F\u0915 \u091C\u0917\u0939\u0964",
    S.onboardingTitle2 to "\u092E\u0941\u092B\u094D\u0924 \u0938\u094D\u0915\u0942\u0932 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0915\u0948\u0902\u092A",
    S.onboardingSub2 to "\u0928\u093F\u092F\u092E\u093F\u0924 \u0938\u094D\u0915\u094D\u0930\u0940\u0928\u093F\u0902\u0917 \u0938\u0947 \u0935\u093F\u0915\u093E\u0938, \u0926\u093E\u0902\u0924 \u0914\u0930 \u0906\u0902\u0916\u094B\u0902 \u0915\u0940 \u0938\u092E\u0938\u094D\u092F\u093E\u0913\u0902 \u0915\u0940 \u091C\u0932\u094D\u0926\u0940 \u092A\u0939\u091A\u093E\u0928 \u0915\u0930\u0947\u0902\u0964",
    S.onboardingTitle3 to "\u0906\u092A\u0915\u0947 \u0938\u092D\u0940 \u092C\u091A\u094D\u091A\u0947 \u090F\u0915 \u091C\u0917\u0939",
    S.onboardingSub3 to "\u0939\u0930 \u092C\u091A\u094D\u091A\u0947 \u0915\u0947 \u0932\u093F\u090F \u0935\u094D\u092F\u0915\u094D\u0924\u093F\u0917\u0924 \u0921\u093E\u0907\u091F \u092A\u094D\u0932\u093E\u0928, \u092A\u094D\u0930\u0917\u0924\u093F \u091F\u094D\u0930\u0948\u0915\u093F\u0902\u0917 \u0914\u0930 \u0939\u0940\u0930\u094B \u092C\u0948\u091C\u0964",
    S.onboardingTitle4 to "\u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u093E \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0938\u093E\u0925\u0940",
    S.onboardingSub4 to "AI-\u0938\u0902\u091A\u093E\u0932\u093F\u0924 \u0921\u093E\u0907\u091F \u091F\u093F\u092A\u094D\u0938, \u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F \u092C\u0941\u0915\u093F\u0902\u0917 \u0914\u0930 \u0938\u093E\u091D\u093E \u0915\u0930\u0928\u0947 \u092F\u094B\u0917\u094D\u092F \u0939\u0947\u0932\u094D\u0925 \u0930\u093F\u092A\u094B\u0930\u094D\u091F\u0964",
    S.getStarted to "\u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902",
    S.createAccount to "\u0916\u093E\u0924\u093E \u092C\u0928\u093E\u090F\u0902",
    S.skip to "\u091B\u094B\u0921\u093C\u0947\u0902",
    S.next to "\u0906\u0917\u0947",
    S.loginSignup to "\u0932\u0949\u0917\u093F\u0928 / \u0938\u093E\u0907\u0928 \u0905\u092A",
    S.loginTab to "\u0932\u0949\u0917\u093F\u0928",
    S.signupTab to "\u0938\u093E\u0907\u0928 \u0905\u092A",
    S.phoneLabel to "\u092B\u093C\u094B\u0928 \u0928\u0902\u092C\u0930",
    S.phonePlaceholder to "\u0905\u092A\u0928\u093E \u092B\u093C\u094B\u0928 \u0928\u0902\u092C\u0930 \u0921\u093E\u0932\u0947\u0902",
    S.yourName to "\u0906\u092A\u0915\u093E \u0928\u093E\u092E",
    S.namePlaceholder to "\u0905\u092A\u0928\u093E \u0928\u093E\u092E \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902",
    S.continueBtn to "\u091C\u093E\u0930\u0940 \u0930\u0916\u0947\u0902",
    S.otpTitle to "\u092B\u093C\u094B\u0928 \u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u0930\u0947\u0902",
    S.otpSubtitle to "\u0907\u0938 \u0928\u0902\u092C\u0930 \u092A\u0930 \u092D\u0947\u091C\u093E \u0917\u092F\u093E 6-\u0905\u0902\u0915\u094B\u0902 \u0915\u093E \u0915\u094B\u0921 \u0921\u093E\u0932\u0947\u0902",
    S.verify to "\u0938\u0924\u094D\u092F\u093E\u092A\u093F\u0924 \u0915\u0930\u0947\u0902",
    S.resend to "\u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0921 \u092D\u0947\u091C\u0947\u0902",
    S.trustBadge to "\u0906\u092A\u0915\u093E \u0921\u0947\u091F\u093E \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0914\u0930 \u0928\u093F\u091C\u0940 \u0939\u0948\u0964 DPDP \u0905\u0928\u0941\u0930\u0942\u092A\u0964",
    S.emailLabel to "\u0908\u092E\u0947\u0932",
    S.passwordLabel to "\u092A\u093E\u0938\u0935\u0930\u094D\u0921",
    S.emailPlaceholder to "parent@example.com",
    S.passwordPlaceholder to "\u0915\u092E \u0938\u0947 \u0915\u092E 6 \u0905\u0915\u094D\u0937\u0930",
    S.namePlaceholderAuth to "\u091C\u0948\u0938\u0947 \u092A\u094D\u0930\u093F\u092F\u093E \u0936\u0930\u094D\u092E\u093E",
    S.phoneTab to "\u092B\u093C\u094B\u0928",
    S.emailTab to "\u0908\u092E\u0947\u0932",
    S.pleaseWait to "\u0915\u0943\u092A\u092F\u093E \u092A\u094D\u0930\u0924\u0940\u0915\u094D\u0937\u093E \u0915\u0930\u0947\u0902\u2026",
    S.sendOtp to "OTP \u092D\u0947\u091C\u0947\u0902",
    S.useEmail to "\u0908\u092E\u0947\u0932 \u0907\u0938\u094D\u0924\u0947\u092E\u093E\u0932 \u0915\u0930\u0947\u0902",
    S.usePhone to "\u092B\u093C\u094B\u0928 \u0907\u0938\u094D\u0924\u0947\u092E\u093E\u0932 \u0915\u0930\u0947\u0902",
    S.signUpHint to "\u0928\u092F\u093E? \u0938\u093E\u0907\u0928 \u0905\u092A",
    S.loginHint to "\u0916\u093E\u0924\u093E \u0939\u0948?",
    S.emailConfirmNote to "\u0939\u092E \u0906\u092A\u0915\u0947 \u0908\u092E\u0947\u0932 \u092A\u0930 \u092A\u0941\u0937\u094D\u091F\u093F \u092D\u0947\u091C\u0947\u0902\u0917\u0947",
    S.smsNote to "\u0939\u092E SMS \u0926\u094D\u0935\u093E\u0930\u093E 6-\u0905\u0902\u0915\u094B\u0902 \u0915\u093E \u0915\u094B\u0921 \u092D\u0947\u091C\u0947\u0902\u0917\u0947",
    S.consentTitle to "\u092E\u093E\u0924\u093E-\u092A\u093F\u0924\u093E \u0915\u0940 \u0938\u0939\u092E\u0924\u093F",
    S.consentBody to "\u0935\u093F\u091F\u093E\u0939\u0940\u0930\u094B \u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u093E \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0921\u0947\u091F\u093E (\u090A\u0902\u091A\u093E\u0908, \u0935\u091C\u0928, \u0926\u093E\u0902\u0924, \u0906\u0902\u0916\u0947\u0902, \u092A\u094B\u0937\u0923) \u090F\u0915\u0924\u094D\u0930 \u0915\u0930\u0924\u093E \u0939\u0948 \u0924\u093E\u0915\u093F \u0935\u094D\u092F\u0915\u094D\u0924\u093F\u0917\u0924 \u0938\u0941\u091D\u093E\u0935 \u0926\u0947 \u0938\u0915\u0947\u0902\u0964 \u092F\u0939 \u0921\u0947\u091F\u093E \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0930\u0916\u093E \u091C\u093E\u0924\u093E \u0939\u0948 \u0914\u0930 \u0906\u092A\u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u0915\u0947 \u092C\u093F\u0928\u093E \u0915\u092D\u0940 \u0938\u093E\u091D\u093E \u0928\u0939\u0940\u0902 \u0915\u093F\u092F\u093E \u091C\u093E\u0924\u093E\u0964",
    S.consentAccept to "\u092E\u0948\u0902 \u0938\u0939\u092E\u0924 \u0939\u0942\u0901 — \u091C\u093E\u0930\u0940 \u0930\u0916\u0947\u0902",
    S.consentDecline to "\u0905\u092D\u0940 \u0928\u0939\u0940\u0902",
    S.goodMorning to "\u0938\u0941\u092A\u094D\u0930\u092D\u093E\u0924,",
    S.hiName to "\u0928\u092E\u0938\u094D\u0924\u0947 %s",
    S.yourKids to "\u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947",
    S.dietPlan to "\u0921\u093E\u0907\u091F \u092A\u094D\u0932\u093E\u0928",
    S.bookVisit to "\u0921\u0949\u0915\u094D\u091F\u0930 \u092C\u0941\u0915 \u0915\u0930\u0947\u0902",
    S.badges to "\u092C\u0948\u091C",
    S.upcomingCamp to "\u0906\u0917\u093E\u092E\u0940 \u0915\u0948\u0902\u092A",
    S.allCamps to "\u0938\u092D\u0940 \u0915\u0948\u0902\u092A",
    S.upcomingAppts to "\u0906\u0917\u093E\u092E\u0940 \u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F",
    S.healthScore to "\u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0938\u094D\u0915\u094B\u0930",
    S.growthOnTrack to "\u0935\u093F\u0915\u093E\u0938 \u091F\u094D\u0930\u0948\u0915 \u092A\u0930",
    S.doingWell to "\u0905\u091A\u094D\u091B\u093E \u091A\u0932 \u0930\u0939\u093E \u0939\u0948",
    S.viewDetails to "\u0935\u093F\u0935\u0930\u0923 \u0926\u0947\u0916\u0947\u0902",
    S.myKids to "\u092E\u0947\u0930\u0947 \u092C\u091A\u094D\u091A\u0947",
    S.addChild to "\u092C\u091A\u094D\u091A\u093E \u091C\u094B\u0921\u093C\u0947\u0902",
    S.kidName to "\u092C\u091A\u094D\u091A\u0947 \u0915\u093E \u0928\u093E\u092E",
    S.kidAge to "\u0906\u092F\u0941 (\u0938\u093E\u0932)",
    S.kidGender to "\u0932\u093F\u0902\u0917",
    S.kidSchool to "\u0938\u094D\u0915\u0942\u0932 \u0915\u093E \u0928\u093E\u092E",
    S.kidGrade to "\u0915\u0915\u094D\u0937\u093E",
    S.kidHeight to "\u090A\u0902\u091A\u093E\u0908 (\u0938\u0947\u092E\u0940)",
    S.kidWeight to "\u0935\u091C\u0928 (\u0915\u093F\u0932\u094B)",
    S.saveKid to "\u092C\u091A\u094D\u091A\u0947 \u0915\u0940 \u092A\u094D\u0930\u094B\u092B\u093E\u0907\u0932 \u0938\u0947\u0935 \u0915\u0930\u0947\u0902",
    S.boy to "\u0932\u0921\u093C\u0915\u093E",
    S.girl to "\u0932\u0921\u093C\u0915\u0940",
    S.growthTab to "\u0935\u093F\u0915\u093E\u0938",
    S.dentalTab to "\u0926\u093E\u0902\u0924",
    S.eyeTab to "\u0906\u0902\u0916\u0947\u0902",
    S.nutritionTab to "\u092A\u094B\u0937\u0923",
    S.heightLabel to "\u090A\u0902\u091A\u093E\u0908",
    S.weightLabel to "\u0935\u091C\u0928",
    S.bmiLabel to "BMI",
    S.logMeasurements to "\u0928\u090F \u092E\u093E\u092A \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902",
    S.newMeasurement to "\u0928\u092F\u093E \u092E\u093E\u092A",
    S.heightTrend to "\u090A\u0902\u091A\u093E\u0908 \u0915\u093E \u0930\u0941\u091D\u093E\u0928",
    S.weightTrend to "\u0935\u091C\u0928 \u0915\u093E \u0930\u0941\u091D\u093E\u0928",
    S.shareReport to "\u0930\u093F\u092A\u094B\u0930\u094D\u091F \u0938\u093E\u091D\u093E \u0915\u0930\u0947\u0902",
    S.generatingReport to "PDF \u0930\u093F\u092A\u094B\u0930\u094D\u091F \u092C\u0928 \u0930\u0939\u0940 \u0939\u0948\u2026",
    S.saveMeasurements to "\u092E\u093E\u092A \u0938\u0947\u0935 \u0915\u0930\u0947\u0902",
    S.viewDietPlan to "\u0906\u091C \u0915\u093E \u0921\u093E\u0907\u091F \u092A\u094D\u0932\u093E\u0928 \u0926\u0947\u0916\u0947\u0902",
    S.todaysPlan to "\u0906\u091C \u0915\u093E \u092A\u094D\u0932\u093E\u0928",
    S.kcalLogged to "%d \u092E\u0947\u0902 \u0938\u0947 %d kcal \u0926\u0930\u094D\u091C",
    S.allMealsLogged to "\u0938\u092D\u0940 \u092D\u094B\u091C\u0928 \u0926\u0930\u094D\u091C — \u0938\u0941\u092A\u0930 \u0908\u091F\u0930 \u0938\u094D\u091F\u094D\u0930\u0940\u0915 \u091C\u093E\u0930\u0940!",
    S.logAllMealsHint to "\u0938\u0941\u092A\u0930 \u0908\u091F\u0930 \u092C\u0948\u091C \u092A\u093E\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0938\u092D\u0940 \u092D\u094B\u091C\u0928 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902",
    S.todaysMeals to "\u0906\u091C \u0915\u093E \u092D\u094B\u091C\u0928",
    S.aiDietCoach to "AI \u0921\u093E\u0907\u091F \u0915\u094B\u091A",
    S.aiSubtitle to "AI \u0926\u094D\u0935\u093E\u0930\u093E \u0935\u094D\u092F\u0915\u094D\u0924\u093F\u0917\u0924 \u0938\u0941\u091D\u093E\u0935",
    S.generateTips to "\u0935\u094D\u092F\u0915\u094D\u0924\u093F\u0917\u0924 \u0921\u093E\u0907\u091F \u091F\u093F\u092A\u094D\u0938 \u092C\u0928\u093E\u090F\u0902",
    S.analyzing to "%s \u0915\u093E \u0921\u0947\u091F\u093E \u0935\u093F\u0936\u094D\u0932\u0947\u0937\u093F\u0924 \u0915\u0930 \u0930\u0939\u0947 \u0939\u0948\u0902\u2026",
    S.craftingTips to "\u0935\u094D\u092F\u0915\u094D\u0924\u093F\u0917\u0924 \u0938\u0941\u091D\u093E\u0935 \u0924\u0948\u092F\u093E\u0930 \u0915\u093F\u090F \u091C\u093E \u0930\u0939\u0947 \u0939\u0948\u0902",
    S.refreshTips to "\u091F\u093F\u092A\u094D\u0938 \u0930\u093F\u092B\u094D\u0930\u0947\u0936 \u0915\u0930\u0947\u0902",
    S.whyMatters to "\u092F\u0939 \u0915\u094D\u092F\u094B\u0902 \u092E\u0939\u0924\u094D\u0935\u092A\u0942\u0930\u094D\u0923 \u0939\u0948",
    S.tryToday to "\u0906\u091C \u092F\u0947 \u0906\u091C\u093C\u092E\u093E\u090F\u0902",
    S.funFact to "\u092E\u091C\u093C\u0947\u0926\u093E\u0930 \u0924\u0925\u094D\u092F",
    S.recognizeFood to "\u092D\u094B\u091C\u0928 \u092A\u0939\u091A\u093E\u0928\u0947\u0902",
    S.schoolCamps to "\u0938\u094D\u0915\u0942\u0932 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u0915\u0948\u0902\u092A",
    S.bookFollowUp to "\u092B\u0949\u0932\u094B-\u0905\u092A \u092C\u0941\u0915 \u0915\u0930\u0947\u0902",
    S.screened to "\u091C\u093E\u0902\u091A \u0915\u093F\u092F\u093E \u0917\u092F\u093E",
    S.upcoming to "\u0906\u0917\u093E\u092E\u0940",
    S.completed to "\u092A\u0942\u0930\u094D\u0923",
    S.heroBadges to "\u0939\u0940\u0930\u094B \u092C\u0948\u091C",
    S.leaderboard to "\u0932\u0940\u0921\u0930\u092C\u094B\u0930\u094D\u0921",
    S.earned to "\u092A\u094D\u0930\u093E\u092A\u094D\u0924",
    S.points to "\u0905\u0902\u0915",
    S.linkedChildren to "\u091C\u0941\u0921\u093C\u0947 \u0939\u0941\u090F \u092C\u091A\u094D\u091A\u0947",
    S.pushNotif to "\u092A\u0941\u0936 \u0928\u094B\u091F\u093F\u092B\u093F\u0915\u0947\u0936\u0928",
    S.campReminders to "\u0915\u0948\u0902\u092A \u0930\u093F\u092E\u093E\u0907\u0902\u0921\u0930",
    S.notifSubtitle to "\u0915\u0948\u0902\u092A, \u091A\u0947\u0915\u0905\u092A \u0914\u0930 \u0921\u093E\u0907\u091F \u0930\u093F\u092E\u093E\u0907\u0902\u0921\u0930",
    S.campReminderSub to "\u0938\u094D\u0915\u0942\u0932 \u0915\u0948\u0902\u092A \u0938\u0947 \u092A\u0939\u0932\u0947 \u0938\u0942\u091A\u0928\u093E \u092A\u093E\u090F\u0902",
    S.linkedHospitals to "\u091C\u0941\u0921\u093C\u0947 \u0939\u0941\u090F \u0905\u0938\u094D\u092A\u0924\u093E\u0932",
    S.familySharing to "\u092A\u0930\u093F\u0935\u093E\u0930 \u0938\u093E\u091D\u093E\u0915\u0930\u0923",
    S.privacyData to "\u0917\u094B\u092A\u0928\u0940\u092F\u0924\u093E \u0914\u0930 \u0921\u0947\u091F\u093E",
    S.helpSupport to "\u0938\u0939\u093E\u092F\u0924\u093E \u0914\u0930 \u0938\u092E\u0930\u094D\u0925\u0928",
    S.darkMode to "\u0921\u093E\u0930\u094D\u0915 \u092E\u094B\u0921",
    S.darkModeSub to "\u0932\u093E\u0907\u091F \u0914\u0930 \u0921\u093E\u0930\u094D\u0915 \u0925\u0940\u092E \u0915\u0947 \u092C\u0940\u091A \u092C\u0926\u0932\u0947\u0902",
    S.language to "\u092D\u093E\u0937\u093E",
    S.logout to "\u0932\u0949\u0917 \u0906\u0909\u091F",
    S.more to "\u0905\u0928\u094D\u092F",
    S.notifications to "\u0938\u0942\u091A\u0928\u093E\u090F\u0902",
    S.familyTitle to "\u092A\u0930\u093F\u0935\u093E\u0930 \u0938\u093E\u091D\u093E\u0915\u0930\u0923",
    S.familySubtitle to "\u0905\u092A\u0928\u0947 \u092C\u091A\u094D\u091A\u094B\u0902 \u0915\u094B \u090F\u0915 \u0938\u093E\u0925 \u091F\u094D\u0930\u0948\u0915 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0938\u0939-\u092E\u093E\u0924\u093E-\u092A\u093F\u0924\u093E \u0915\u094B \u0906\u092E\u0902\u0924\u094D\u0930\u093F\u0924 \u0915\u0930\u0947\u0902",
    S.yourFamilyCode to "\u0906\u092A\u0915\u093E \u092A\u0930\u093F\u0935\u093E\u0930 \u0915\u094B\u0921",
    S.enterFamilyCode to "\u092A\u0930\u093F\u0935\u093E\u0930 \u0938\u0947 \u091C\u0941\u0921\u093C\u0947\u0902",
    S.joinFamily to "\u092A\u0930\u093F\u0935\u093E\u0930 \u0938\u0947 \u091C\u0941\u0921\u093C\u0947\u0902",
    S.familyCodePlaceholder to "\u092A\u0930\u093F\u0935\u093E\u0930 \u0915\u094B\u0921 \u0921\u093E\u0932\u0947\u0902",
    S.shareYourCode to "\u092F\u0939 \u0915\u094B\u0921 \u0905\u092A\u0928\u0947 \u0938\u0939-\u092E\u093E\u0924\u093E-\u092A\u093F\u0924\u093E \u0915\u094B \u092D\u0947\u091C\u0947\u0902",
    S.notifCenter to "\u0938\u0942\u091A\u0928\u093E \u0915\u0947\u0902\u0926\u094D\u0930",
    S.foodRecTitle to "\u092D\u094B\u091C\u0928 \u092A\u0939\u091A\u093E\u0928",
    S.foodRecSub to "\u0905\u092A\u0928\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0947 \u092D\u094B\u091C\u0928 \u0915\u0940 \u0924\u0938\u094D\u0935\u0940\u0930 \u0932\u0947\u0915\u0930 \u0924\u0941\u0930\u0902\u0924 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902",
    S.captureFood to "\u092D\u094B\u091C\u0928 \u0915\u0940 \u0924\u0938\u094D\u0935\u0940\u0930 \u0932\u0947\u0902",
    S.analyzingFood to "\u0906\u092A\u0915\u0940 \u0924\u0938\u094D\u0935\u0940\u0930 \u0915\u093E \u0935\u093F\u0936\u094D\u0932\u0947\u0937\u0923 \u0915\u093F\u092F\u093E \u091C\u093E \u0930\u0939\u093E \u0939\u0948\u2026",
    S.detectedFood to "\u092A\u0939\u091A\u093E\u0928\u0947 \u0917\u090F \u092D\u094B\u091C\u0928",
    S.logAsMeal to "\u092D\u094B\u091C\u0928 \u0915\u0947 \u0930\u0942\u092A \u092E\u0947\u0902 \u0926\u0930\u094D\u091C \u0915\u0930\u0947\u0902",
    S.noFoodDetected to "\u0915\u094B\u0908 \u092D\u094B\u091C\u0928 \u0928\u0939\u0940\u0902 \u092A\u0939\u091A\u093E\u0928\u093E \u0917\u092F\u093E\u0964 \u0915\u0943\u092A\u092F\u093E \u0938\u093E\u092B\u093C \u0924\u0938\u094D\u0935\u0940\u0930 \u0932\u0947\u0902\u0964",
    S.bookAppt to "\u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F \u092C\u0941\u0915 \u0915\u0930\u0947\u0902",
    S.selectDoctor to "\u0921\u0949\u0915\u094D\u091F\u0930 \u091A\u0941\u0928\u0947\u0902",
    S.selectHospital to "\u0905\u0938\u094D\u092A\u0924\u093E\u0932 \u091A\u0941\u0928\u0947\u0902",
    S.hospitalsNearYou to "\u0906\u092A\u0915\u0947 \u0915\u094D\u0937\u0947\u0924\u094D\u0930 \u092E\u0947\u0902 \u0905\u0938\u094D\u092A\u0924\u093E\u0932",
    S.campPartnerHospital to "\u0936\u093F\u092C\u093F\u0930 \u0938\u093E\u0925\u0940",
    S.conductedCampsCount to "%d \u0938\u094D\u0915\u0942\u0932 \u0936\u093F\u092C\u093F\u0930 \u0915\u0930 \u091A\u0941\u0915\u0947",
    S.viewByHospital to "\u0905\u0938\u094D\u092A\u0924\u093E\u0932 \u0915\u0947 \u0905\u0928\u0941\u0938\u093E\u0930",
    S.viewBySpecialty to "\u0935\u093F\u0936\u0947\u0937\u0924\u093E \u0915\u0947 \u0905\u0928\u0941\u0938\u093E\u0930",
    S.yourArea to "\u0906\u092A\u0915\u093E \u0915\u094D\u0937\u0947\u0924\u094D\u0930",
    S.noHospitalsFound to "\u0907\u0938 \u0915\u094D\u0937\u0947\u0924\u094D\u0930 \u092E\u0947\u0902 \u0915\u094B\u0908 \u0905\u0938\u094D\u092A\u0924\u093E\u0932 \u0928\u0939\u0940\u0902",
    S.kmAway to "%s \u0915\u093F\u092E\u0940 \u0926\u0942\u0930",
    S.useMyLocation to "\u092E\u0947\u0930\u093E \u0938\u094D\u0925\u093E\u0928 \u0909\u092A\u092F\u094B\u0917 \u0915\u0930\u0947\u0902",
    S.locationSorted to "\u0906\u092A\u0915\u0947 \u0928\u093F\u0915\u091F \u0926\u0942\u0930\u0940 \u0915\u0947 \u0905\u0928\u0941\u0938\u093E\u0930 \u0915\u094D\u0930\u092E \u092E\u0947\u0902",
    S.hospitalPartnersSub to "\u0906\u092A\u0915\u0947 \u092A\u093E\u0938 \u092A\u093E\u0930\u094D\u091F\u0928\u0930 \u0905\u0938\u094D\u092A\u0924\u093E\u0932 \u2014 \u0936\u093F\u092C\u093F\u0930 \u0938\u093E\u0925\u0940 \u092A\u0939\u0932\u0947",
    S.selectKid to "\u0915\u093F\u0938 \u092C\u091A\u094D\u091A\u0947 \u0915\u0947 \u0932\u093F\u090F?",
    S.selectDate to "\u0924\u093E\u0930\u0940\u0916 \u091A\u0941\u0928\u0947\u0902",
    S.selectTime to "\u0938\u092E\u092F \u091A\u0941\u0928\u0947\u0902",
    S.confirmBooking to "\u092C\u0941\u0915\u093F\u0902\u0917 \u0915\u0940 \u092A\u0941\u0937\u094D\u091F\u093F \u0915\u0930\u0947\u0902",
    S.cancelAppt to "\u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F \u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902",
    S.yourAppts to "\u0906\u092A\u0915\u0947 \u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F",
    S.disclaimer to "\u0915\u0947\u0935\u0932 \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0915\u0947 \u0932\u093F\u090F\u0964 \u091A\u093F\u0915\u093F\u0924\u094D\u0938\u093E \u0938\u0932\u093E\u0939 \u0915\u0947 \u0932\u093F\u090F \u0939\u092E\u0947\u0936\u093E \u0921\u0949\u0915\u094D\u091F\u0930 \u0938\u0947 \u092A\u0930\u093E\u092E\u0930\u094D\u0936 \u0915\u0930\u0947\u0902\u0964",
    S.version to "\u0935\u093F\u091F\u093E\u0939\u0940\u0930\u094B v1.0",
    S.back to "\u0935\u093E\u092A\u0938",
    S.save to "\u0938\u0947\u0935 \u0915\u0930\u0947\u0902",
    S.cancel to "\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902",
    S.ok to "\u0920\u0940\u0915 \u0939\u0948",
    S.wearableTitle to "\u0939\u0947\u0932\u094D\u0925 \u0915\u0928\u0947\u0915\u094D\u091F",
    S.wearableSub to "\u0905\u092A\u0928\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0947 \u0921\u093F\u0935\u093E\u0907\u0938 \u0938\u0947 \u0915\u0926\u092E\u094B\u0902 \u0915\u0940 \u0917\u093F\u0928\u0924\u0940 \u0914\u0930 \u0917\u0924\u093F\u0935\u093F\u0927\u093F \u0921\u0947\u091F\u093E \u0938\u093F\u0902\u0915 \u0915\u0930\u0947\u0902",
    S.connectHealth to "\u0939\u0947\u0932\u094D\u0925 \u0921\u0947\u091F\u093E \u0915\u0928\u0947\u0915\u094D\u091F \u0915\u0930\u0947\u0902",
    S.stepsToday to "\u0906\u091C \u0915\u0947 \u0915\u0926\u092E",
    S.activeMinutes to "\u0938\u0915\u094D\u0930\u093F\u092F \u092E\u093F\u0928\u091F",
    S.syncedFrom to "\u0921\u093F\u0935\u093E\u0907\u0938 \u0938\u0947 \u0938\u093F\u0902\u0915",
    S.healthConnectInstall to "\u0917\u0924\u093F\u0935\u093F\u0927\u093F \u0921\u0947\u091F\u093E \u0938\u093F\u0902\u0915 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F Play Store \u0938\u0947 Health Connect \u0907\u0902\u0938\u094D\u091F\u0949\u0932 \u0915\u0930\u0947\u0902\u0964",
    S.deleteKid to "\u092C\u091A\u094D\u091A\u0947 \u0939\u091F\u093E\u090F\u0902",
    S.deleteKidConfirm to "\u0915\u094D\u092F\u093E \u0907\u0938 \u092C\u091A\u094D\u091A\u0947 \u0915\u094B \u0939\u091F\u093E\u0928\u093E \u0939\u0948?",
    S.deleteKidBody to "\u0907\u0938 \u092C\u091A\u094D\u091A\u0947 \u0915\u0947 \u0938\u092D\u0940 \u092D\u094B\u091C\u0928, \u0938\u094D\u091F\u094D\u0930\u0940\u0915 \u0914\u0930 \u0935\u093F\u0915\u093E\u0938 \u0921\u0947\u091F\u093E \u0939\u092E\u0947\u0936\u093E \u0915\u0947 \u0932\u093F\u090F \u0939\u091F \u091C\u093E\u090F\u0917\u093E\u0964",
    S.syncFailed to "\u0921\u0947\u091F\u093E \u0938\u0947\u0935 \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u093E\u0964 \u0915\u0943\u092A\u092F\u093E \u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964",
    S.familyInvalid to "\u092A\u0930\u093F\u0935\u093E\u0930 \u0915\u094B\u0921 \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u093E\u0964 \u0915\u094B\u0921 \u091C\u093E\u0902\u091A \u0915\u0930\u0947\u0902\u0964",
    S.noFamilyCodeYet to "\u0938\u0939-\u092A\u093E\u0932\u0915 \u0915\u094B \u0906\u092E\u0902\u0924\u094D\u0930\u093F\u0924 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u092A\u0930\u093F\u0935\u093E\u0930 \u0915\u094B\u0921 \u092C\u0928\u093E\u090F\u0902\u0964",
    S.generateFamilyCode to "\u092A\u0930\u093F\u0935\u093E\u0930 \u0915\u094B\u0921 \u092C\u0928\u093E\u090F\u0902",
    S.todayLabel to "\u0906\u091C",
    S.tomorrowLabel to "\u0915\u0932",
    S.linkedHospitalsSub to "Partner hospitals near you — camp partners shown first",
    S.privacyDataSub to "DPDP \u0905\u0928\u0941\u092A\u093E\u0932\u0928 \u00B7 \u092E\u093E\u0924\u093E-\u092A\u093F\u0924\u093E \u0938\u0939\u092E\u0924\u093F",
    S.helpSupportSub to "\u0938\u0939\u093E\u092F\u0924\u093E \u091F\u0940\u092E \u0915\u094B \u0908\u092E\u0947\u0932 \u0915\u0930\u0947\u0902",
    S.backLabel to "\u0935\u093E\u092A\u0938",
    S.closeLabel to "\u092C\u0902\u0926 \u0915\u0930\u0947\u0902",
    S.cancelLabel to "\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902",
    S.viewLabel to "\u0926\u0947\u0916\u0947\u0902",
    S.loadingLabel to "\u0932\u094B\u0921 \u0939\u094B \u0930\u0939\u093E \u0939\u0948\u2026",
    S.you to "\u0906\u092A",
    S.theSchool to "\u0938\u094D\u0915\u0942\u0932",
    S.campConsentTitle to "\u0905\u0928\u0941\u092E\u0924\u093F",
    S.campConsentSub to "\u0938\u094D\u0915\u0942\u0932 \u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0940 \u091C\u093E\u0901\u091A \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u092E\u093E\u0901\u0917 \u0930\u0939\u093E \u0939\u0948",
    S.noConsentPending to "\u091C\u0935\u093E\u092C \u0926\u0947\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u0941\u091B \u0928\u0939\u0940\u0902",
    S.noConsentPendingSub to "\u0906\u092A\u0928\u0947 \u0938\u092D\u0940 \u0905\u0928\u0941\u0930\u094B\u0927\u094B\u0902 \u0915\u093E \u091C\u0935\u093E\u092C \u0926\u0947 \u0926\u093F\u092F\u093E \u0939\u0948\u0964 \u0938\u094D\u0915\u0942\u0932 \u0926\u094B\u092C\u093E\u0930\u093E \u092A\u0942\u091B\u0947\u0917\u093E \u0924\u094B \u0939\u092E \u0906\u092A\u0915\u094B \u092C\u0924\u093E\u090F\u0901\u0917\u0947\u0964",
    S.consentChecksTitle to "\u0915\u094D\u092F\u093E-\u0915\u094D\u092F\u093E \u091C\u093E\u0901\u091A\u093E \u091C\u093E\u090F\u0917\u093E",
    S.consentChecksHint to "\u091C\u094B \u0928\u0939\u0940\u0902 \u0915\u0930\u0935\u093E\u0928\u093E \u091A\u093E\u0939\u0924\u0947 \u0909\u0938\u0947 \u0939\u091F\u093E \u0926\u0947\u0902\u0964 \u092C\u093E\u0915\u0940 \u091C\u093E\u0901\u091A\u0947\u0902 \u092B\u093F\u0930 \u092D\u0940 \u0939\u094B\u0902\u0917\u0940\u0964",
    S.consentGrant to "\u0939\u093E\u0901, \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902",
    S.campConsentDecline to "\u0928\u0939\u0940\u0902, \u0907\u0938 \u092C\u093E\u0930 \u0928\u0939\u0940\u0902",
    S.consentDeadlineMsg to "\u0915\u0943\u092A\u092F\u093E %s \u0924\u0915 \u091C\u0935\u093E\u092C \u0926\u0947\u0902\u0964",
    S.consentChangeMind to "\u0906\u092A \u0915\u092D\u0940 \u092D\u0940 \u0905\u092A\u0928\u093E \u0928\u093F\u0930\u094D\u0923\u092F \u092C\u0926\u0932 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902 \u2014 \u0915\u0948\u0902\u092A \u0938\u0947 \u092A\u0939\u0932\u0947 \u092F\u093E \u092C\u093E\u0926 \u092E\u0947\u0902\u0964",
    S.consentRecordedYes to "\u0927\u0928\u094D\u092F\u0935\u093E\u0926\u0964 \u0906\u092A\u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u0926\u0930\u094D\u091C \u0939\u094B \u0917\u0908 \u0939\u0948\u0964",
    S.consentRecordedNo to "\u0926\u0930\u094D\u091C \u0939\u094B \u0917\u092F\u093E\u0964 \u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0940 \u091C\u093E\u0901\u091A \u0928\u0939\u0940\u0902 \u0939\u094B\u0917\u0940\u0964",
    S.consentFailed to "\u0939\u092E \u0907\u0938\u0947 \u0926\u0930\u094D\u091C \u0928\u0939\u0940\u0902 \u0915\u0930 \u0938\u0915\u0947\u0964 \u0915\u0943\u092A\u092F\u093E \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964",
    S.photoConsentTitle to "\u092B\u093C\u094B\u091F\u094B",
    S.photoConsentBody to "\u0907\u0938 \u0915\u0948\u0902\u092A \u092E\u0947\u0902 \u0921\u0949\u0915\u094D\u091F\u0930 \u091C\u094B \u092E\u093F\u0932\u0947 \u0909\u0938\u0915\u0940 \u092B\u093C\u094B\u091F\u094B \u0932\u0947\u0928\u093E \u091A\u093E\u0939 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902 \u2014 \u091C\u0948\u0938\u0947 \u0915\u094B\u0908 \u091A\u0915\u0924\u094D\u0924\u093E \u092F\u093E \u0906\u0901\u0916\u0964 \u092F\u0939 \u0905\u0932\u0917 \u0938\u0935\u093E\u0932 \u0939\u0948\u0964 \u0906\u092A \u091C\u093E\u0901\u091A \u0915\u0947 \u0932\u093F\u090F \u0939\u093E\u0901 \u0914\u0930 \u092B\u093C\u094B\u091F\u094B \u0915\u0947 \u0932\u093F\u090F \u0928\u093E \u0915\u0939 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964",
    S.photoConsentAgree to "\u092B\u093C\u094B\u091F\u094B \u0932\u0947\u0928\u0947 \u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u0939\u0948",
    S.campResultTitle to "\u0915\u0948\u0902\u092A \u0915\u093E \u092A\u0930\u093F\u0923\u093E\u092E",
    S.resultUnderReview to "\u0921\u0949\u0915\u094D\u091F\u0930 \u0905\u092D\u0940 \u0907\u0938\u0947 \u0926\u0947\u0916 \u0930\u0939\u0947 \u0939\u0948\u0902",
    S.resultUnderReviewSub to "\u091C\u092C \u0924\u0915 \u0921\u0949\u0915\u094D\u091F\u0930 \u0907\u0938\u0947 \u0928\u0939\u0940\u0902 \u0926\u0947\u0916 \u0932\u0947\u0924\u0947, \u0915\u0941\u091B \u0928\u0939\u0940\u0902 \u0926\u093F\u0916\u093E\u092F\u093E \u091C\u093E\u0924\u093E\u0964 \u0909\u0928\u0915\u0947 \u0926\u0947\u0916 \u0932\u0947\u0928\u0947 \u092A\u0930 \u092F\u0939 \u092F\u0939\u093E\u0901 \u0906 \u091C\u093E\u090F\u0917\u093E\u0964",
    S.doctorSays to "\u0921\u0949\u0915\u094D\u091F\u0930 \u0915\u0940 \u0938\u0932\u093E\u0939",
    S.photosTitle to "\u092B\u093C\u094B\u091F\u094B",
    S.photosSub to "\u0906\u092A\u0915\u0940 \u0905\u0928\u0941\u092E\u0924\u093F \u0938\u0947 \u0932\u0940 \u0917\u0908 \u0939\u0948\u0902\u0964 \u0907\u0928\u094D\u0939\u0947\u0902 \u0915\u0947\u0935\u0932 \u0915\u0948\u0902\u092A \u0915\u0940 \u091A\u093F\u0915\u093F\u0924\u094D\u0938\u093E \u091F\u0940\u092E \u0914\u0930 \u0906\u092A \u0926\u0947\u0916 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964",
    S.photoUnavailable to "\u092F\u0939 \u092B\u093C\u094B\u091F\u094B \u0928\u0939\u0940\u0902 \u0916\u0941\u0932 \u0938\u0915\u0940\u0964",
    S.questionsTitle to "\u0938\u094D\u0915\u0942\u0932 \u0938\u0947 \u092A\u0942\u091B\u0947\u0902",
    S.questionsSub to "\u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0940 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u091C\u093E\u0901\u091A \u0915\u0947 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902",
    S.questionsClosed to "\u0905\u092D\u0940 \u0938\u0935\u093E\u0932 \u0928\u0939\u0940\u0902 \u0932\u093F\u090F \u091C\u093E \u0930\u0939\u0947",
    S.questionsClosedSub to "\u0906\u092A\u0915\u093E \u0938\u094D\u0915\u0942\u0932 \u092B\u093C\u093F\u0932\u0939\u093E\u0932 \u0910\u092A \u0915\u0947 \u091C\u093C\u0930\u093F\u090F \u0938\u0935\u093E\u0932\u094B\u0902 \u0915\u093E \u091C\u0935\u093E\u092C \u0928\u0939\u0940\u0902 \u0926\u0947 \u0930\u0939\u093E\u0964 \u0915\u0943\u092A\u092F\u093E \u0938\u0940\u0927\u0947 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902\u0964",
    S.questionsNoticeFallback to "\u092F\u0939 \u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0940 \u0938\u094D\u0915\u0942\u0932 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u091C\u093E\u0901\u091A \u0938\u0947 \u091C\u0941\u0921\u093C\u0947 \u0938\u0935\u093E\u0932\u094B\u0902 \u0915\u0947 \u0932\u093F\u090F \u0939\u0948\u0964 \u0907\u0938\u0947 \u092A\u0942\u0930\u0947 \u0926\u093F\u0928 \u0928\u0939\u0940\u0902 \u0926\u0947\u0916\u093E \u091C\u093E\u0924\u093E \u0914\u0930 \u0915\u093F\u0938\u0940 \u092D\u0940 \u0906\u092A\u093E\u0924 \u0938\u094D\u0925\u093F\u0924\u093F \u0915\u0947 \u0932\u093F\u090F \u0907\u0938\u0915\u093E \u0909\u092A\u092F\u094B\u0917 \u0928 \u0915\u0930\u0947\u0902\u0964 \u0905\u0917\u0930 \u0906\u092A\u0915\u093E \u092C\u091A\u094D\u091A\u093E \u0905\u092D\u0940 \u092C\u0940\u092E\u093E\u0930 \u0939\u0948, \u0924\u094B \u0905\u092A\u0928\u0947 \u0921\u0949\u0915\u094D\u091F\u0930 \u0915\u094B \u092B\u093C\u094B\u0928 \u0915\u0930\u0947\u0902 \u092F\u093E \u0905\u0938\u094D\u092A\u0924\u093E\u0932 \u091C\u093E\u090F\u0901\u0964",
    S.yourQuestions to "\u0906\u092A\u0915\u0947 \u0938\u0935\u093E\u0932",
    S.askTheSchool to "\u090F\u0915 \u0938\u0935\u093E\u0932 \u092A\u0942\u091B\u0947\u0902",
    S.replyWithinDays to "\u0938\u094D\u0915\u0942\u0932 %s \u0926\u093F\u0928\u094B\u0902 \u092E\u0947\u0902 \u091C\u0935\u093E\u092C \u0926\u0947\u0928\u0947 \u0915\u093E \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0924\u093E \u0939\u0948\u0964",
    S.aboutWhichChild to "\u0915\u093F\u0938 \u092C\u091A\u094D\u091A\u0947 \u0915\u0947 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902?",
    S.questionPlaceholder to "\u0905\u092A\u0928\u093E \u0938\u0935\u093E\u0932 \u092F\u0939\u093E\u0901 \u0932\u093F\u0916\u0947\u0902",
    S.notUrgentAck to "\u092E\u0948\u0902 \u0938\u092E\u091D\u0924\u093E/\u0938\u092E\u091D\u0924\u0940 \u0939\u0942\u0901 \u0915\u093F \u092F\u0939 \u0906\u092A\u093E\u0924 \u0938\u094D\u0925\u093F\u0924\u093F \u0915\u0947 \u0932\u093F\u090F \u0928\u0939\u0940\u0902 \u0939\u0948, \u0914\u0930 \u0905\u0917\u0930 \u092E\u0947\u0930\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u094B \u0905\u092D\u0940 \u092E\u0926\u0926 \u091A\u093E\u0939\u093F\u090F \u0924\u094B \u092E\u0948\u0902 \u0921\u0949\u0915\u094D\u091F\u0930 \u0915\u094B \u092B\u093C\u094B\u0928 \u0915\u0930\u0942\u0901\u0917\u093E/\u0915\u0930\u0942\u0901\u0917\u0940\u0964",
    S.sendQuestion to "\u0938\u0935\u093E\u0932 \u092D\u0947\u091C\u0947\u0902",
    S.awaitingSchool to "\u091C\u0935\u093E\u092C \u0915\u093E \u0907\u0902\u0924\u091C\u093C\u093E\u0930",
    S.schoolReplied to "\u0938\u094D\u0915\u0942\u0932 \u0928\u0947 \u091C\u0935\u093E\u092C \u0926\u093F\u092F\u093E",
    S.questionSentMsg to "\u092D\u0947\u091C \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964 \u0938\u094D\u0915\u0942\u0932 %s \u0926\u093F\u0928\u094B\u0902 \u092E\u0947\u0902 \u091C\u0935\u093E\u092C \u0926\u0947\u0928\u0947 \u0915\u093E \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0917\u093E\u0964",
    S.questionFailed to "\u0939\u092E \u0907\u0938\u0947 \u092D\u0947\u091C \u0928\u0939\u0940\u0902 \u0938\u0915\u0947\u0964 \u0915\u0943\u092A\u092F\u093E \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964",
    S.libraryTitle to "\u092A\u0922\u093C\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F",
    S.librarySub to "\u0906\u092A\u0915\u0947 \u0905\u092A\u0928\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0947 \u092A\u0930\u093F\u0923\u093E\u092E\u094B\u0902 \u0938\u0947 \u091A\u0941\u0928\u093E \u0917\u092F\u093E",
    S.forYourFamily to "\u0906\u092A\u0915\u0947 \u092A\u0930\u093F\u0935\u093E\u0930 \u0915\u0947 \u0932\u093F\u090F",
    S.generalReading to "\u0938\u092C\u0915\u0947 \u0932\u093F\u090F",
    S.becauseOfFinding to "%s1 \u0915\u0947 %s2 \u092A\u0930\u093F\u0923\u093E\u092E \u0915\u0947 \u0915\u093E\u0930\u0923",
    S.libraryEmpty to "\u0905\u092D\u0940 \u092A\u0922\u093C\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u0941\u091B \u0928\u0939\u0940\u0902",
    S.libraryDisclaimer to "\u092F\u0939 \u0938\u093E\u092E\u093E\u0928\u094D\u092F \u0938\u0932\u093E\u0939 \u0939\u0948, \u0915\u094B\u0908 \u0928\u093F\u0926\u093E\u0928 \u0928\u0939\u0940\u0902\u0964 \u0905\u0917\u0930 \u0906\u092A\u0915\u094B \u0905\u092A\u0928\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0940 \u091A\u093F\u0902\u0924\u093E \u0939\u0948, \u0924\u094B \u0921\u0949\u0915\u094D\u091F\u0930 \u0938\u0947 \u092E\u093F\u0932\u0947\u0902\u0964",
    S.referralsTitle to "\u0906\u0917\u0947 \u0915\u0940 \u0915\u093E\u0930\u094D\u0930\u0935\u093E\u0908",
    S.referralsSub to "\u0915\u0948\u0902\u092A \u0915\u0947 \u092C\u093E\u0926 \u0915\u094D\u092F\u093E \u0915\u0930\u0928\u093E \u0939\u0948",
    S.noReferrals to "\u0915\u0941\u091B \u092D\u0940 \u0915\u0930\u0928\u093E \u092C\u093E\u0915\u0940 \u0928\u0939\u0940\u0902",
    S.noReferralsSub to "\u0915\u093F\u0938\u0940 \u0921\u0949\u0915\u094D\u091F\u0930 \u0928\u0947 \u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u094B \u0915\u0939\u0940\u0902 \u0932\u0947 \u091C\u093E\u0928\u0947 \u0915\u094B \u0928\u0939\u0940\u0902 \u0915\u0939\u093E \u0939\u0948\u0964",
    S.referralDueBy to "%s \u0924\u0915 \u0915\u0930 \u0932\u0947\u0928\u093E \u092C\u0947\u0939\u0924\u0930 \u0939\u0948\u0964",
    S.referralBooked to "\u092E\u0948\u0902\u0928\u0947 \u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F \u0932\u0947 \u0932\u093F\u092F\u093E \u0939\u0948",
    S.referralAttended to "\u0939\u092E \u0917\u090F, \u0914\u0930 \u0939\u094B \u0917\u092F\u093E",
    S.referralNotGoing to "\u0939\u092E \u092F\u0939 \u0928\u0939\u0940\u0902 \u0915\u0930\u0935\u093E\u090F\u0901\u0917\u0947",
    S.referralClosed to "\u092A\u0942\u0930\u093E \u0939\u0941\u0906",
    S.referralUpdateFailed to "\u0939\u092E \u0907\u0938\u0947 \u0938\u0939\u0947\u091C \u0928\u0939\u0940\u0902 \u0938\u0915\u0947\u0964 \u0915\u0943\u092A\u092F\u093E \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964",
    S.urgencyUrgent to "\u0924\u0941\u0930\u0902\u0924",
    S.urgencySoon to "\u091C\u0932\u094D\u0926",
    S.urgencyRoutine to "\u091C\u092C \u0939\u094B \u0938\u0915\u0947",
    S.privacyTitle to "\u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u093E \u0930\u093F\u0915\u0949\u0930\u094D\u0921",
    S.privacySub to "\u0915\u094D\u092F\u093E \u0930\u0916\u093E \u091C\u093E\u0924\u093E \u0939\u0948, \u0914\u0930 \u0906\u092A \u0909\u0938\u0915\u0947 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902 \u0915\u094D\u092F\u093E \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902",
    S.careIsFreeTitle to "\u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u092A\u0930\u093F\u0923\u093E\u092E \u092E\u0941\u092B\u093C\u094D\u0924 \u0939\u0948\u0902",
    S.careIsFreeBody to "\u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0947 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F \u092A\u0930\u093F\u0923\u093E\u092E, \u0906\u0917\u0947 \u0915\u0940 \u0915\u093E\u0930\u094D\u0930\u0935\u093E\u0908 \u0914\u0930 \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u092E\u0941\u092B\u093C\u094D\u0924 \u0939\u0948\u0902 \u0914\u0930 \u0939\u092E\u0947\u0936\u093E \u0930\u0939\u0947\u0902\u0917\u0947\u0964 \u092D\u0941\u0917\u0924\u093E\u0928 \u0935\u093E\u0932\u0940 \u092F\u094B\u091C\u0928\u093E \u0915\u0947\u0935\u0932 \u0938\u0941\u0935\u093F\u0927\u093E\u090F\u0901 \u091C\u094B\u0921\u093C\u0924\u0940 \u0939\u0948\u0964",
    S.withdrawTitle to "\u0938\u094D\u0915\u0942\u0932 \u0915\u093E\u0930\u094D\u092F\u0915\u094D\u0930\u092E \u0938\u0947 \u0939\u091F\u0947\u0902",
    S.withdrawBody to "\u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0940 \u092D\u0935\u093F\u0937\u094D\u092F \u0915\u0947 \u0915\u093F\u0938\u0940 \u092D\u0940 \u0915\u0948\u0902\u092A \u092E\u0947\u0902 \u091C\u093E\u0901\u091A \u0928\u0939\u0940\u0902 \u0939\u094B\u0917\u0940\u0964 \u092A\u0939\u0932\u0947 \u0938\u0947 \u091C\u093E\u0930\u0940 \u092A\u0930\u093F\u0923\u093E\u092E \u0906\u092A\u0915\u0947 \u0910\u092A \u092E\u0947\u0902 \u0930\u0939\u0947\u0902\u0917\u0947, \u0914\u0930 \u0906\u092A \u0915\u092D\u0940 \u092D\u0940 \u0909\u0928\u094D\u0939\u0947\u0902 \u0939\u091F\u093E\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u0939 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964",
    S.withdrawAction to "\u0939\u091F\u0947\u0902",
    S.withdrawReasonHint to "\u0915\u094D\u092F\u094B\u0902? (\u0935\u0948\u0915\u0932\u094D\u092A\u093F\u0915)",
    S.withdrawConfirm to "\u0939\u093E\u0901, \u0939\u091F\u0947\u0902",
    S.consentWithdrawn to "\u0939\u091F\u093E \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964 \u0906\u092A\u0915\u0947 \u092C\u091A\u094D\u091A\u0947 \u0915\u0940 \u0926\u094B\u092C\u093E\u0930\u093E \u091C\u093E\u0901\u091A \u0928\u0939\u0940\u0902 \u0939\u094B\u0917\u0940\u0964",
    S.consentWithdrawFailed to "\u0939\u092E \u092F\u0939 \u0928\u0939\u0940\u0902 \u0915\u0930 \u0938\u0915\u0947\u0964 \u0915\u0943\u092A\u092F\u093E \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964",
    S.rightsHistoryTitle to "\u0907\u0938 \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u0915\u0947 \u0938\u093E\u0925 \u0915\u094D\u092F\u093E \u0939\u0941\u0906",
    S.rightsHistorySub to "\u0939\u0930 \u0928\u093F\u0930\u094D\u092F\u093E\u0924, \u0938\u0941\u0927\u093E\u0930 \u0914\u0930 \u0935\u093E\u092A\u0938\u0940, \u0915\u094D\u0930\u092E \u092E\u0947\u0902\u0964",
    S.correctionSent to "\u091C\u093E\u0901\u091A \u0915\u0947 \u0932\u093F\u090F \u0938\u094D\u0915\u0942\u0932 \u0915\u094B \u092D\u0947\u091C \u0926\u093F\u092F\u093E \u0917\u092F\u093E\u0964",
    S.correctionFailed to "\u0939\u092E \u0907\u0938\u0947 \u092D\u0947\u091C \u0928\u0939\u0940\u0902 \u0938\u0915\u0947\u0964 \u0915\u0943\u092A\u092F\u093E \u0926\u094B\u092C\u093E\u0930\u093E \u0915\u094B\u0936\u093F\u0936 \u0915\u0930\u0947\u0902\u0964",
)

private val te = mapOf(
    S.risingHero to "%s \u0C12\u0C15 \u0C0E\u0C26\u0C41\u0C17\u0C41\u0C24\u0C41\u0C28\u0C4D\u0C28 \u0C39\u0C40\u0C30\u0C4B!",
    S.notMeasuredMsg to "\u0C08 \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37 \u0C07\u0C02\u0C15\u0C3E \u0C1C\u0C30\u0C17\u0C32\u0C47\u0C26\u0C41. \u0C24\u0C26\u0C41\u0C2A\u0C30\u0C3F \u0C38\u0C4D\u0C15\u0C42\u0C32\u0C4D \u0C39\u0C46\u0C32\u0C4D\u0C24\u0C4D \u0C15\u0C4D\u0C2F\u0C3E\u0C02\u0C2A\u0C4D \u0C24\u0C30\u0C4D\u0C35\u0C3E\u0C24 \u0C07\u0C15\u0C4D\u0C15\u0C21 \u0C15\u0C28\u0C2C\u0C21\u0C41\u0C24\u0C41\u0C02\u0C26\u0C3F.",
    S.onboardingTitle1 to "\u0C2E\u0C40 \u0C2A\u0C3F\u0C32\u0C4D\u0C32 \u0C0E\u0C26\u0C41\u0C17\u0C41\u0C26\u0C32\u0C28\u0C41 \u0C39\u0C40\u0C30\u0C4B\u0C17\u0C3E \u0C1F\u0C4D\u0C30\u0C3E\u0C15\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F!",
    S.onboardingSub1 to "\u0C38\u0C4D\u0C15\u0C42\u0C32\u0C4D \u0C15\u0C4D\u0C2F\u0C3E\u0C02\u0C2A\u0C41\u0C32\u0C41, \u0C21\u0C48\u0C1F\u0C4D \u0C2A\u0C4D\u0C32\u0C3E\u0C28\u0C4D\u0C32\u0C41, \u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D \u0C38\u0C39\u0C3E\u0C2F\u0C02 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C30\u0C3F\u0C35\u0C3E\u0C30\u0C4D\u0C21\u0C41\u0C32\u0C41 — \u0C05\u0C28\u0C4D\u0C28\u0C40 \u0C12\u0C15\u0C47 \u0C1A\u0C4B\u0C1F\u0C41\u0C32\u0C4B.",
    S.onboardingTitle2 to "\u0C09\u0C1A\u0C3F\u0C24 \u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32 \u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F \u0C36\u0C3F\u0C2C\u0C3F\u0C30\u0C3E\u0C32\u0C41",
    S.onboardingSub2 to "\u0C15\u0C4D\u0C30\u0C2E\u0C2E\u0C48\u0C28 \u0C38\u0C4D\u0C15\u0C4D\u0C30\u0C40\u0C28\u0C3F\u0C02\u0C17\u0C4D\u0C32\u0C24\u0C4B \u0C0E\u0C26\u0C41\u0C17\u0C41\u0C26\u0C32, \u0C26\u0C3E\u0C02\u0C24\u0C3E\u0C32\u0C41 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C15\u0C33\u0C4D\u0C33 \u0C38\u0C2E\u0C38\u0C4D\u0C2F\u0C32\u0C28\u0C41 \u0C2E\u0C41\u0C02\u0C26\u0C41\u0C17\u0C3E\u0C28\u0C47 \u0C17\u0C41\u0C30\u0C4D\u0C24\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
    S.onboardingTitle3 to "\u0C2E\u0C40 \u0C2A\u0C3F\u0C32\u0C4D\u0C32\u0C32\u0C28\u0C4D\u0C26\u0C30\u0C42 \u0C12\u0C15\u0C47 \u0C1A\u0C4B\u0C1F\u0C4D\u0C32\u0C4B",
    S.onboardingSub3 to "\u0C2A\u0C4D\u0C30\u0C24\u0C3F \u0C2A\u0C3F\u0C32\u0C4D\u0C32\u0C15\u0C41 \u0C35\u0C4D\u0C2F\u0C15\u0C4D\u0C24\u0C3F\u0C17\u0C24 \u0C21\u0C48\u0C1F\u0C4D \u0C2A\u0C4D\u0C32\u0C3E\u0C28\u0C4D\u0C32\u0C41, \u0C2A\u0C41\u0C30\u0C4B\u0C17\u0C24\u0C3F \u0C1F\u0C4D\u0C30\u0C3E\u0C15\u0C3F\u0C02\u0C17\u0C4D \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C39\u0C40\u0C30\u0C4B \u0C2C\u0C4D\u0C2F\u0C3E\u0C21\u0C4D\u0C1C\u0C40\u0C32\u0C41.",
    S.onboardingTitle4 to "\u0C2E\u0C40 \u0C2A\u0C3F\u0C32\u0C4D\u0C32 \u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F \u0C38\u0C39\u0C1A\u0C3E\u0C30\u0C3F",
    S.onboardingSub4 to "AI-\u0C24\u0C4B \u0C21\u0C48\u0C1F\u0C4D \u0C1A\u0C3F\u0C1F\u0C4D\u0C15\u0C3E\u0C32\u0C41, \u0C05\u0C2A\u0C3E\u0C2F\u0C3F\u0C02\u0C1F\u0C4D\u200C\u0C2E\u0C46\u0C02\u0C1F\u0C4D \u0C2C\u0C41\u0C15\u0C3F\u0C02\u0C17\u0C4D \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C37\u0C47\u0C30\u0C4D \u0C1A\u0C47\u0C2F\u0C17\u0C32 \u0C39\u0C46\u0C32\u0C4D\u0C24\u0C4D \u0C30\u0C3F\u0C2A\u0C4B\u0C30\u0C4D\u0C1F\u0C41\u0C32\u0C41.",
    S.getStarted to "\u0C2A\u0C4D\u0C30\u0C3E\u0C30\u0C02\u0C2D\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.createAccount to "\u0C16\u0C3E\u0C24\u0C3E \u0C38\u0C43\u0C37\u0C4D\u0C1F\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.skip to "\u0C26\u0C3E\u0C1F\u0C35\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.next to "\u0C24\u0C30\u0C41\u0C35\u0C3E\u0C24",
    S.loginSignup to "\u0C32\u0C3E\u0C17\u0C3F\u0C28\u0C4D / \u0C38\u0C48\u0C28\u0C4D \u0C05\u0C2A\u0C4D",
    S.loginTab to "\u0C32\u0C3E\u0C17\u0C3F\u0C28\u0C4D",
    S.signupTab to "\u0C38\u0C48\u0C28\u0C4D \u0C05\u0C2A\u0C4D",
    S.phoneLabel to "\u0C2B\u0C4B\u0C28\u0C4D \u0C28\u0C02\u0C2C\u0C30\u0C4D",
    S.phonePlaceholder to "\u0C2E\u0C40 \u0C2B\u0C4B\u0C28\u0C4D \u0C28\u0C02\u0C2C\u0C30\u0C4D \u0C28\u0C2E\u0C4B\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.yourName to "\u0C2E\u0C40 \u0C2A\u0C47\u0C30\u0C41",
    S.namePlaceholder to "\u0C2E\u0C40 \u0C2A\u0C47\u0C30\u0C41 \u0C28\u0C2E\u0C4B\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.continueBtn to "\u0C15\u0C4A\u0C28\u0C38\u0C3E\u0C17\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.otpTitle to "\u0C2B\u0C4B\u0C28\u0C4D \u0C27\u0C43\u0C35\u0C40\u0C15\u0C30\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.otpSubtitle to "\u0C08 \u0C28\u0C02\u0C2C\u0C30\u0C4D\u200C\u0C15\u0C3F \u0C2A\u0C02\u0C2A\u0C3F\u0C28 6-\u0C05\u0C02\u0C15\u0C46\u0C32 \u0C15\u0C4B\u0C21\u0C4D \u0C28\u0C2E\u0C4B\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.verify to "\u0C27\u0C43\u0C35\u0C40\u0C15\u0C30\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.resend to "\u0C15\u0C4B\u0C21\u0C4D \u0C2E\u0C33\u0C4D\u0C32\u0C40 \u0C2A\u0C02\u0C2A\u0C02\u0C21\u0C3F",
    S.trustBadge to "\u0C2E\u0C40 \u0C21\u0C47\u0C1F\u0C3E \u0C38\u0C41\u0C30\u0C15\u0C4D\u0C37\u0C3F\u0C24\u0C02 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C17\u0C4B\u0C2A\u0C4D\u0C2F\u0C02. DPDP \u0C05\u0C28\u0C41\u0C38\u0C30\u0C3F\u0C02\u0C1A\u0C3F\u0C28\u0C26\u0C3F.",
    S.emailLabel to "\u0C07\u0C2E\u0C46\u0C2F\u0C3F\u0C32\u0C4D",
    S.passwordLabel to "\u0C2A\u0C3E\u0C38\u0C4D\u200C\u0C35\u0C30\u0C4D\u0C21\u0C4D",
    S.emailPlaceholder to "parent@example.com",
    S.passwordPlaceholder to "\u0C15\u0C28\u0C40\u0C38\u0C02 6 \u0C05\u0C15\u0C4D\u0C37\u0C30\u0C3E\u0C32\u0C41",
    S.namePlaceholderAuth to "\u0C09\u0C26\u0C3E. \u0C2A\u0C4D\u0C30\u0C3F\u0C2F \u0C36\u0C30\u0C4D\u0C2E",
    S.phoneTab to "\u0C2B\u0C4B\u0C28\u0C4D",
    S.emailTab to "\u0C07\u0C2E\u0C46\u0C2F\u0C3F\u0C32\u0C4D",
    S.pleaseWait to "\u0C26\u0C2F\u0C1A\u0C47\u0C38\u0C3F \u0C35\u0C47\u0C1A\u0C3F \u0C09\u0C02\u0C21\u0C02\u0C21\u0C3F\u2026",
    S.sendOtp to "OTP \u0C2A\u0C02\u0C2A\u0C02\u0C21\u0C3F",
    S.useEmail to "\u0C07\u0C2E\u0C46\u0C2F\u0C3F\u0C32\u0C4D \u0C09\u0C2A\u0C2F\u0C4B\u0C17\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.usePhone to "\u0C2B\u0C4B\u0C28\u0C4D \u0C09\u0C2A\u0C2F\u0C4B\u0C17\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.signUpHint to "\u0C15\u0C4A\u0C24\u0C4D\u0C24\u0C26\u0C3F? \u0C38\u0C48\u0C28\u0C4D \u0C05\u0C2A\u0C4D",
    S.loginHint to "\u0C16\u0C3E\u0C24\u0C3E \u0C09\u0C02\u0C26\u0C3E?",
    S.emailConfirmNote to "\u0C2E\u0C47\u0C2E\u0C4D \u0C2E\u0C40 \u0C07\u0C2E\u0C46\u0C2F\u0C3F\u0C32\u0C4D\u200C\u0C15\u0C3F \u0C28\u0C3F\u0C30\u0C4D\u0C27\u0C3E\u0C30\u0C23 \u0C2A\u0C02\u0C2A\u0C41\u0C24\u0C3E\u0C2E\u0C41",
    S.smsNote to "\u0C2E\u0C47\u0C2E\u0C4D SMS \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E 6-\u0C05\u0C02\u0C15\u0C46\u0C32 \u0C15\u0C4B\u0C21\u0C4D \u0C2A\u0C02\u0C2A\u0C41\u0C24\u0C3E\u0C2E\u0C41",
    S.consentTitle to "\u0C24\u0C32\u0C4D\u0C32\u0C3F\u0C26\u0C02\u0C21\u0C4D\u0C30\u0C41\u0C32 \u0C05\u0C28\u0C41\u0C2E\u0C24\u0C3F",
    S.consentBody to "\u0C35\u0C4D\u0C2F\u0C15\u0C4D\u0C24\u0C3F\u0C17\u0C24 \u0C38\u0C32\u0C39\u0C3E\u0C32\u0C41 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C38\u0C3F\u0C2B\u0C3E\u0C30\u0C4D\u0C38\u0C41\u0C32\u0C28\u0C41 \u0C05\u0C02\u0C26\u0C3F\u0C02\u0C1A\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C35\u0C40\u0C1F\u0C3E\u0C39\u0C40\u0C30\u0C4B \u0C2E\u0C40 \u0C2A\u0C3F\u0C32\u0C4D\u0C32 \u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F \u0C21\u0C47\u0C1F\u0C3E\u0C28\u0C41 \u0C38\u0C47\u0C15\u0C30\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C02\u0C26\u0C3F. \u0C08 \u0C21\u0C47\u0C1F\u0C3E \u0C38\u0C41\u0C30\u0C15\u0C4D\u0C37\u0C3F\u0C24\u0C02\u0C17\u0C3E \u0C09\u0C02\u0C1A\u0C2C\u0C21\u0C41\u0C24\u0C41\u0C02\u0C26\u0C3F \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C2E\u0C40 \u0C05\u0C28\u0C41\u0C2E\u0C24\u0C3F \u0C32\u0C47\u0C15\u0C41\u0C02\u0C21\u0C3E \u0C0E\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C42 \u0C37\u0C47\u0C30\u0C4D \u0C1A\u0C47\u0C2F\u0C2C\u0C21\u0C26\u0C41.",
    S.consentAccept to "\u0C28\u0C47\u0C28\u0C41 \u0C05\u0C02\u0C17\u0C40\u0C15\u0C30\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C28\u0C41 — \u0C15\u0C4A\u0C28\u0C38\u0C3E\u0C17\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.consentDecline to "\u0C07\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C41 \u0C35\u0C26\u0C4D\u0C26\u0C41",
    S.goodMorning to "\u0C36\u0C41\u0C2D\u0C4B\u0C26\u0C2F\u0C02,",
    S.hiName to "\u0C28\u0C2E\u0C38\u0C4D\u0C15\u0C3E\u0C30\u0C02 %s",
    S.yourKids to "\u0C2E\u0C40 \u0C2A\u0C3F\u0C32\u0C4D\u0C32\u0C32\u0C41",
    S.dietPlan to "\u0C21\u0C48\u0C1F\u0C4D \u0C2A\u0C4D\u0C32\u0C3E\u0C28\u0C4D",
    S.bookVisit to "\u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D \u0C2C\u0C41\u0C15\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.badges to "\u0C2C\u0C4D\u0C2F\u0C3E\u0C21\u0C4D\u0C1C\u0C40\u0C32\u0C41",
    S.upcomingCamp to "\u0C30\u0C3E\u0C2C\u0C4B\u0C2F\u0C47 \u0C15\u0C4D\u0C2F\u0C3E\u0C02\u0C2A\u0C41",
    S.allCamps to "\u0C05\u0C28\u0C4D\u0C28\u0C40 \u0C15\u0C4D\u0C2F\u0C3E\u0C02\u0C2A\u0C41\u0C32\u0C41",
    S.upcomingAppts to "\u0C30\u0C3E\u0C2C\u0C4B\u0C2F\u0C47 \u0C05\u0C2A\u0C3E\u0C2F\u0C3F\u0C02\u0C1F\u0C4D\u200C\u0C2E\u0C46\u0C02\u0C1F\u0C4D\u0C32\u0C41",
    S.healthScore to "\u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F \u0C38\u0C4D\u0C15\u0C4B\u0C30\u0C41",
    S.growthOnTrack to "\u0C0E\u0C26\u0C41\u0C17\u0C41\u0C26\u0C32 \u0C1F\u0C4D\u0C30\u0C3E\u0C15\u0C4D\u200C\u0C32\u0C4B \u0C09\u0C02\u0C26\u0C3F",
    S.doingWell to "\u0C2C\u0C3E\u0C17\u0C3E \u0C09\u0C02\u0C26\u0C3F",
    S.viewDetails to "\u0C35\u0C3F\u0C35\u0C30\u0C3E\u0C32\u0C41 \u0C1A\u0C42\u0C21\u0C02\u0C21\u0C3F",
    S.myKids to "\u0C28\u0C3E \u0C2A\u0C3F\u0C32\u0C4D\u0C32\u0C32\u0C41",
    S.addChild to "\u0C2A\u0C3F\u0C32\u0C4D\u0C32\u0C28\u0C41 \u0C1C\u0C4B\u0C21\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.kidName to "\u0C2A\u0C3F\u0C32\u0C4D\u0C32 \u0C2A\u0C47\u0C30\u0C41",
    S.kidAge to "\u0C35\u0C2F\u0C38\u0C4D\u0C38\u0C41 (\u0C38\u0C02\u0C35\u0C24\u0C4D\u0C38\u0C30\u0C3E\u0C32\u0C41)",
    S.kidGender to "\u0C32\u0C3F\u0C02\u0C17\u0C02",
    S.kidSchool to "\u0C38\u0C4D\u0C15\u0C42\u0C32\u0C4D \u0C2A\u0C47\u0C30\u0C41",
    S.kidGrade to "\u0C24\u0C30\u0C17\u0C24\u0C3F",
    S.kidHeight to "\u0C0E\u0C24\u0C4D\u0C24\u0C41 (\u0C38\u0C46\u0C02.\u0C2E\u0C40.)",
    S.kidWeight to "\u0C2C\u0C30\u0C41\u0C35\u0C41 (\u0C15\u0C47.\u0C1C\u0C40.)",
    S.saveKid to "\u0C2A\u0C3F\u0C32\u0C4D\u0C32 \u0C2A\u0C4D\u0C30\u0C4A\u0C2B\u0C48\u0C32\u0C4D \u0C38\u0C47\u0C35\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.boy to "\u0C05\u0C2C\u0C4D\u0C2C\u0C3E\u0C2F\u0C3F",
    S.girl to "\u0C05\u0C2E\u0C4D\u0C2E\u0C3E\u0C2F\u0C3F",
    S.growthTab to "\u0C0E\u0C26\u0C41\u0C17\u0C41\u0C26\u0C32",
    S.dentalTab to "\u0C26\u0C3E\u0C02\u0C24\u0C3E\u0C32\u0C41",
    S.eyeTab to "\u0C15\u0C33\u0C4D\u0C32\u0C41",
    S.nutritionTab to "\u0C2A\u0C4B\u0C37\u0C23",
    S.heightLabel to "\u0C0E\u0C24\u0C4D\u0C24\u0C41",
    S.weightLabel to "\u0C2C\u0C30\u0C41\u0C35\u0C41",
    S.bmiLabel to "BMI",
    S.logMeasurements to "\u0C15\u0C4A\u0C24\u0C4D\u0C24 \u0C15\u0C4A\u0C32\u0C24\u0C32\u0C41 \u0C28\u0C2E\u0C4B\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.newMeasurement to "\u0C15\u0C4A\u0C24\u0C4D\u0C24 \u0C15\u0C4A\u0C32\u0C24",
    S.heightTrend to "\u0C0E\u0C24\u0C4D\u0C24\u0C41 \u0C27\u0C4B\u0C30\u0C23\u0C3F",
    S.weightTrend to "\u0C2C\u0C30\u0C41\u0C35\u0C41 \u0C27\u0C4B\u0C30\u0C23\u0C3F",
    S.shareReport to "\u0C30\u0C3F\u0C2A\u0C4B\u0C30\u0C4D\u0C1F\u0C4D \u0C37\u0C47\u0C30\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.generatingReport to "PDF \u0C30\u0C3F\u0C2A\u0C4B\u0C30\u0C4D\u0C1F\u0C4D \u0C24\u0C2F\u0C3E\u0C30\u0C35\u0C41\u0C24\u0C4B\u0C02\u0C26\u0C3F\u2026",
    S.saveMeasurements to "\u0C15\u0C4A\u0C32\u0C24\u0C32\u0C41 \u0C38\u0C47\u0C35\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.viewDietPlan to "\u0C08\u0C30\u0C4B\u0C1C\u0C41 \u0C21\u0C48\u0C1F\u0C4D \u0C2A\u0C4D\u0C32\u0C3E\u0C28\u0C4D \u0C1A\u0C42\u0C21\u0C02\u0C21\u0C3F",
    S.dentalGoodMsg to "\u0C1A\u0C3F\u0C35\u0C30\u0C3F \u0C1A\u0C46\u0C15\u0C4D\u200C\u0C32\u0C4B \u0C15\u0C3E\u0C35\u0C3F\u0C1F\u0C40\u0C32\u0C41 \u0C15\u0C28\u0C3F\u0C2A\u0C3F\u0C02\u0C1A\u0C32\u0C47\u0C26\u0C41. \u0C30\u0C4B\u0C1C\u0C41\u0C15\u0C41 \u0C30\u0C46\u0C02\u0C21\u0C41\u0C38\u0C3E\u0C30\u0C4D\u0C32\u0C41 \u0C2C\u0C4D\u0C30\u0C37\u0C4D \u0C1A\u0C47\u0C38\u0C4D\u0C24\u0C42 \u0C09\u0C02\u0C21\u0C02\u0C21\u0C3F.",
    S.dentalWatchMsg to "\u0C1A\u0C3F\u0C28\u0C4D\u0C28 \u0C2B\u0C32\u0C15\u0C02 \u0C15\u0C28\u0C3F\u0C2A\u0C3F\u0C02\u0C1A\u0C3F\u0C02\u0C26\u0C3F. 2 \u0C35\u0C3E\u0C30\u0C3E\u0C32\u0C4D\u0C32\u0C4B \u0C21\u0C46\u0C02\u0C1F\u0C32\u0C4D \u0C2B\u0C3E\u0C32\u0C4B-\u0C05\u0C2A\u0C4D \u0C38\u0C3F\u0C2B\u0C3E\u0C30\u0C38\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F.",
    S.eyeGoodMsg to "\u0C26\u0C43\u0C37\u0C4D\u0C1F\u0C3F \u0C2C\u0C3E\u0C17\u0C3E \u0C09\u0C02\u0C26\u0C3F (6/6). \u0C26\u0C3F\u0C26\u0C4D\u0C26\u0C41\u0C2C\u0C3E\u0C1F\u0C41 \u0C05\u0C35\u0C38\u0C30\u0C02 \u0C32\u0C47\u0C26\u0C41.",
    S.eyeWatchMsg to "\u0C1A\u0C3F\u0C28\u0C4D\u0C28 \u0C26\u0C43\u0C37\u0C4D\u0C1F\u0C3F \u0C12\u0C24\u0C4D\u0C24\u0C3F\u0C21\u0C3F \u0C15\u0C28\u0C3F\u0C2A\u0C3F\u0C02\u0C1A\u0C3F\u0C02\u0C26\u0C3F. \u0C15\u0C02\u0C1F\u0C3F \u0C28\u0C3F\u0C2A\u0C41\u0C23\u0C41\u0C21\u0C3F \u0C2B\u0C3E\u0C32\u0C4B-\u0C05\u0C2A\u0C4D \u0C2A\u0C30\u0C3F\u0C17\u0C23\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
    S.disclaimerShort to "\u0C38\u0C2E\u0C3E\u0C1A\u0C3E\u0C30 \u0C2A\u0C4D\u0C30\u0C2F\u0C4B\u0C1C\u0C28\u0C3E\u0C32\u0C15\u0C41 \u0C2E\u0C3E\u0C24\u0C4D\u0C30\u0C2E\u0C47. \u0C30\u0C4B\u0C17 \u0C28\u0C3F\u0C30\u0C4D\u0C27\u0C3E\u0C30\u0C23 \u0C15\u0C4B\u0C38\u0C02 \u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D\u200C\u0C28\u0C3F \u0C38\u0C02\u0C2A\u0C4D\u0C30\u0C26\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
    S.disclaimerChart to "\u0C1A\u0C3E\u0C30\u0C4D\u0C1F\u0C41\u0C32\u0C41 \u0C38\u0C2E\u0C3E\u0C1A\u0C3E\u0C30 \u0C2A\u0C4D\u0C30\u0C2F\u0C4B\u0C1C\u0C28\u0C3E\u0C32\u0C15\u0C41 \u0C2E\u0C3E\u0C24\u0C4D\u0C30\u0C2E\u0C47. \u0C35\u0C48\u0C26\u0C4D\u0C2F \u0C28\u0C3F\u0C30\u0C4D\u0C23\u0C2F\u0C3E\u0C32 \u0C15\u0C4B\u0C38\u0C02 \u0C0E\u0C32\u0C4D\u0C32\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C42 \u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D\u200C\u0C28\u0C3F \u0C38\u0C02\u0C2A\u0C4D\u0C30\u0C26\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
    S.todaysPlan to "\u0C08\u0C30\u0C4B\u0C1C\u0C41 \u0C2A\u0C4D\u0C32\u0C3E\u0C28\u0C4D",
    S.kcalLogged to "%d \u0C32\u0C4B %d kcal \u0C28\u0C2E\u0C4B\u0C26\u0C41 \u0C1A\u0C47\u0C36\u0C3E\u0C30\u0C41",
    S.allMealsLogged to "\u0C05\u0C28\u0C4D\u0C28\u0C40 \u0C2D\u0C4B\u0C1C\u0C28\u0C3E\u0C32\u0C41 \u0C28\u0C2E\u0C4B\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C2C\u0C21\u0C4D\u0C21\u0C3E\u0C2F\u0C3F — \u0C38\u0C42\u0C2A\u0C30\u0C4D \u0C08\u0C1F\u0C30\u0C4D \u0C38\u0C4D\u0C1F\u0C4D\u0C30\u0C40\u0C15\u0C4D \u0C15\u0C4A\u0C28\u0C38\u0C3E\u0C17\u0C41\u0C24\u0C4B\u0C02\u0C26\u0C3F!",
    S.logAllMealsHint to "\u0C38\u0C42\u0C2A\u0C30\u0C4D \u0C08\u0C1F\u0C30\u0C4D \u0C2C\u0C4D\u0C2F\u0C3E\u0C21\u0C4D\u0C1C\u0C40 \u0C38\u0C02\u0C2A\u0C3E\u0C26\u0C3F\u0C02\u0C1A\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C05\u0C28\u0C4D\u0C28\u0C40 \u0C2D\u0C4B\u0C1C\u0C28\u0C3E\u0C32\u0C28\u0C41 \u0C28\u0C2E\u0C4B\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.todaysMeals to "\u0C08\u0C30\u0C4B\u0C1C\u0C41 \u0C2D\u0C4B\u0C1C\u0C28\u0C3E\u0C32\u0C41",
    S.aiDietCoach to "AI \u0C21\u0C48\u0C1F\u0C4D \u0C15\u0C4B\u0C1A\u0C4D",
    S.aiSubtitle to "AI \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E \u0C35\u0C4D\u0C2F\u0C15\u0C4D\u0C24\u0C3F\u0C17\u0C24 \u0C38\u0C32\u0C39\u0C3E\u0C32\u0C41",
    S.generateTips to "\u0C35\u0C4D\u0C2F\u0C15\u0C4D\u0C24\u0C3F\u0C17\u0C24 \u0C21\u0C48\u0C1F\u0C4D \u0C1A\u0C3F\u0C1F\u0C4D\u0C15\u0C3E\u0C32\u0C41 \u0C30\u0C42\u0C2A\u0C4A\u0C02\u0C26\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.analyzing to "%s \u0C21\u0C47\u0C1F\u0C3E\u0C28\u0C41 \u0C35\u0C3F\u0C36\u0C4D\u0C32\u0C47\u0C37\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C28\u0C41\u2026",
    S.craftingTips to "\u0C35\u0C4D\u0C2F\u0C15\u0C4D\u0C24\u0C3F\u0C17\u0C24 \u0C38\u0C3F\u0C2B\u0C3E\u0C30\u0C4D\u0C38\u0C41\u0C32\u0C28\u0C41 \u0C30\u0C42\u0C2A\u0C4A\u0C02\u0C26\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C28\u0C41",
    S.refreshTips to "\u0C1A\u0C3F\u0C1F\u0C4D\u0C15\u0C3E\u0C32\u0C41 \u0C30\u0C3F\u0C2B\u0C4D\u0C30\u0C46\u0C37\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.whyMatters to "\u0C07\u0C26\u0C3F \u0C0E\u0C02\u0C26\u0C41\u0C15\u0C41 \u0C2E\u0C41\u0C16\u0C4D\u0C2F\u0C02",
    S.tryToday to "\u0C08\u0C30\u0C4B\u0C1C\u0C41 \u0C07\u0C26\u0C3F \u0C1F\u0C4D\u0C30\u0C48 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.funFact to "\u0C38\u0C30\u0C26\u0C3E \u0C35\u0C3F\u0C37\u0C2F\u0C02",
    S.recognizeFood to "\u0C06\u0C39\u0C3E\u0C30\u0C3E\u0C28\u0C4D\u0C28\u0C3F \u0C17\u0C41\u0C30\u0C4D\u0C24\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.schoolCamps to "\u0C38\u0C4D\u0C15\u0C42\u0C32\u0C4D \u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F \u0C36\u0C3F\u0C2C\u0C3F\u0C30\u0C3E\u0C32\u0C41",
    S.bookFollowUp to "\u0C2B\u0C3E\u0C32\u0C4B-\u0C05\u0C2A\u0C4D \u0C2C\u0C41\u0C15\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.screened to "\u0C38\u0C4D\u0C15\u0C4D\u0C30\u0C40\u0C28\u0C4D \u0C1A\u0C47\u0C2F\u0C2C\u0C21\u0C3F\u0C02\u0C26\u0C3F",
    S.upcoming to "\u0C30\u0C3E\u0C2C\u0C4B\u0C2F\u0C47",
    S.completed to "\u0C2A\u0C42\u0C30\u0C4D\u0C24\u0C3F \u0C1A\u0C47\u0C38\u0C3F\u0C28\u0C26\u0C3F",
    S.heroBadges to "\u0C39\u0C40\u0C30\u0C4B \u0C2C\u0C4D\u0C2F\u0C3E\u0C21\u0C4D\u0C1C\u0C40\u0C32\u0C41",
    S.leaderboard to "\u0C32\u0C40\u0C21\u0C30\u0C4D\u200C\u0C2C\u0C4B\u0C30\u0C4D\u0C21\u0C41",
    S.earned to "\u0C38\u0C3E\u0C27\u0C3F\u0C02\u0C1A\u0C3F\u0C28\u0C35\u0C3F",
    S.points to "\u0C2A\u0C3E\u0C2F\u0C3F\u0C02\u0C1F\u0C4D\u0C32\u0C41",
    S.linkedChildren to "\u0C05\u0C28\u0C41\u0C38\u0C02\u0C27\u0C3E\u0C28\u0C3F\u0C02\u0C1A\u0C3F\u0C28 \u0C2A\u0C3F\u0C32\u0C4D\u0C32\u0C32\u0C41",
    S.pushNotif to "\u0C2A\u0C41\u0C37\u0C4D \u0C28\u0C4B\u0C1F\u0C3F\u0C2B\u0C3F\u0C15\u0C47\u0C37\u0C28\u0C4D\u0C32\u0C41",
    S.campReminders to "\u0C15\u0C4D\u0C2F\u0C3E\u0C02\u0C2A\u0C4D \u0C30\u0C3F\u0C2E\u0C48\u0C02\u0C21\u0C30\u0C4D\u0C32\u0C41",
    S.notifSubtitle to "\u0C15\u0C4D\u0C2F\u0C3E\u0C02\u0C2A\u0C4D, \u0C1A\u0C46\u0C15\u0C2A\u0C4D \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C21\u0C48\u0C1F\u0C4D \u0C30\u0C3F\u0C2E\u0C48\u0C02\u0C21\u0C30\u0C4D\u0C32\u0C41",
    S.campReminderSub to "\u0C38\u0C4D\u0C15\u0C42\u0C32\u0C4D \u0C15\u0C4D\u0C2F\u0C3E\u0C02\u0C2A\u0C41\u0C32\u0C15\u0C41 \u0C2E\u0C41\u0C02\u0C26\u0C41 \u0C28\u0C4B\u0C1F\u0C3F\u0C2B\u0C3F\u0C15\u0C47\u0C37\u0C28\u0C4D \u0C2A\u0C4A\u0C02\u0C21\u0C02\u0C21\u0C3F",
    S.linkedHospitals to "\u0C05\u0C28\u0C41\u0C38\u0C02\u0C27\u0C3E\u0C28\u0C3F\u0C02\u0C1A\u0C3F\u0C28 \u0C06\u0C38\u0C41\u0C2A\u0C24\u0C4D\u0C30\u0C3F",
    S.familySharing to "\u0C15\u0C41\u0C1F\u0C41\u0C02\u0C2C \u0C37\u0C47\u0C30\u0C3F\u0C02\u0C17\u0C4D",
    S.privacyData to "\u0C17\u0C4B\u0C2A\u0C4D\u0C2F\u0C24 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C21\u0C47\u0C1F\u0C3E",
    S.helpSupport to "\u0C38\u0C39\u0C3E\u0C2F\u0C02 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C2E\u0C26\u0C4D\u0C26\u0C24\u0C41",
    S.darkMode to "\u0C21\u0C3E\u0C30\u0C4D\u0C15\u0C4D \u0C2E\u0C4B\u0C21\u0C4D",
    S.darkModeSub to "\u0C32\u0C48\u0C1F\u0C4D \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C21\u0C3E\u0C30\u0C4D\u0C15\u0C4D \u0C25\u0C40\u0C2E\u0C4D \u0C2E\u0C27\u0C4D\u0C2F \u0C2E\u0C3E\u0C30\u0C4D\u0C1A\u0C02\u0C21\u0C3F",
    S.language to "\u0C2D\u0C3E\u0C37",
    S.logout to "\u0C32\u0C3E\u0C17\u0C4D \u0C05\u0C35\u0C41\u0C1F\u0C4D",
    S.more to "\u0C2E\u0C30\u0C3F\u0C28\u0C4D\u0C28\u0C3F",
    S.notifications to "\u0C28\u0C4B\u0C1F\u0C3F\u0C2B\u0C3F\u0C15\u0C47\u0C37\u0C28\u0C4D\u0C32\u0C41",
    S.familyTitle to "\u0C15\u0C41\u0C1F\u0C41\u0C02\u0C2C \u0C37\u0C47\u0C30\u0C3F\u0C02\u0C17\u0C4D",
    S.familySubtitle to "\u0C2E\u0C40 \u0C2A\u0C3F\u0C32\u0C4D\u0C32\u0C32\u0C28\u0C41 \u0C15\u0C32\u0C3F\u0C38\u0C3F \u0C1F\u0C4D\u0C30\u0C3E\u0C15\u0C4D \u0C1A\u0C47\u0C2F\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C38\u0C39-\u0C24\u0C32\u0C4D\u0C32\u0C3F\u0C26\u0C02\u0C21\u0C4D\u0C30\u0C41\u0C32\u0C28\u0C41 \u0C06\u0C39\u0C4D\u0C35\u0C3E\u0C28\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.yourFamilyCode to "\u0C2E\u0C40 \u0C2B\u0C4D\u0C2F\u0C3E\u0C2E\u0C3F\u0C32\u0C40 \u0C15\u0C4B\u0C21\u0C4D",
    S.enterFamilyCode to "\u0C2B\u0C4D\u0C2F\u0C3E\u0C2E\u0C3F\u0C32\u0C40\u0C32\u0C4B \u0C1A\u0C47\u0C30\u0C02\u0C21\u0C3F",
    S.joinFamily to "\u0C2B\u0C4D\u0C2F\u0C3E\u0C2E\u0C3F\u0C32\u0C40\u0C32\u0C4B \u0C1A\u0C47\u0C30\u0C02\u0C21\u0C3F",
    S.familyCodePlaceholder to "\u0C2B\u0C4D\u0C2F\u0C3E\u0C2E\u0C3F\u0C32\u0C40 \u0C15\u0C4B\u0C21\u0C4D \u0C28\u0C2E\u0C4B\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.shareYourCode to "\u0C08 \u0C15\u0C4B\u0C21\u0C4D\u200C\u0C28\u0C3F \u0C2E\u0C40 \u0C38\u0C39-\u0C24\u0C32\u0C4D\u0C32\u0C3F\u0C26\u0C02\u0C21\u0C4D\u0C30\u0C41\u0C32\u0C24\u0C4B \u0C37\u0C47\u0C30\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.notifCenter to "\u0C28\u0C4B\u0C1F\u0C3F\u0C2B\u0C3F\u0C15\u0C47\u0C37\u0C28\u0C4D \u0C15\u0C47\u0C02\u0C26\u0C4D\u0C30\u0C02",
    S.foodRecTitle to "\u0C06\u0C39\u0C3E\u0C30 \u0C17\u0C41\u0C30\u0C4D\u0C24\u0C3F\u0C02\u0C2A\u0C41",
    S.foodRecSub to "\u0C2E\u0C40 \u0C2A\u0C3F\u0C32\u0C4D\u0C32 \u0C2D\u0C4B\u0C1C\u0C28\u0C3E\u0C28\u0C4D\u0C28\u0C3F \u0C24\u0C15\u0C4D\u0C37\u0C23\u0C2E\u0C47 \u0C32\u0C3E\u0C17\u0C4D \u0C1A\u0C47\u0C2F\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C2B\u0C4B\u0C1F\u0C4B \u0C24\u0C40\u0C2F\u0C02\u0C21\u0C3F",
    S.captureFood to "\u0C2D\u0C4B\u0C1C\u0C28\u0C3E\u0C28\u0C4D\u0C28\u0C3F \u0C15\u0C4D\u0C2F\u0C3E\u0C2A\u0C4D\u0C1A\u0C30\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.analyzingFood to "\u0C2E\u0C40 \u0C2B\u0C4B\u0C1F\u0C4B\u0C28\u0C41 \u0C35\u0C3F\u0C36\u0C4D\u0C32\u0C47\u0C37\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C28\u0C41\u2026",
    S.detectedFood to "\u0C17\u0C41\u0C30\u0C4D\u0C24\u0C3F\u0C02\u0C1A\u0C3F\u0C28 \u0C06\u0C39\u0C3E\u0C30\u0C3E\u0C32\u0C41",
    S.logAsMeal to "\u0C2D\u0C4B\u0C1C\u0C28\u0C02\u0C17\u0C3E \u0C32\u0C3E\u0C17\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.noFoodDetected to "\u0C0F \u0C06\u0C39\u0C3E\u0C30\u0C3E\u0C32\u0C41 \u0C17\u0C41\u0C30\u0C4D\u0C24\u0C3F\u0C02\u0C1A\u0C2C\u0C21\u0C32\u0C47\u0C26\u0C41. \u0C38\u0C4D\u0C2A\u0C37\u0C4D\u0C1F\u0C2E\u0C48\u0C28 \u0C2B\u0C4B\u0C1F\u0C4B \u0C24\u0C40\u0C2F\u0C02\u0C21\u0C3F.",
    S.bookAppt to "\u0C05\u0C2A\u0C3E\u0C2F\u0C3F\u0C02\u0C1F\u0C4D\u200C\u0C2E\u0C46\u0C02\u0C1F\u0C4D \u0C2C\u0C41\u0C15\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.selectDoctor to "\u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D\u200C\u0C28\u0C3F \u0C0E\u0C02\u0C1A\u0C41\u0C15\u0C4B\u0C02\u0C21\u0C3F",
    S.selectHospital to "\u0C06\u0C38\u0C2A\u0C24\u0C4D\u0C30\u0C2E\u0C41 \u0C0E\u0C02\u0C1A\u0C41\u0C15\u0C4B\u0C02\u0C21\u0C3F",
    S.hospitalsNearYou to "\u0C2E\u0C40 \u0C2A\u0C3F\u0C30\u0C3F\u0C35\u0C47\u0C36\u0C02\u0C32\u0C4B \u0C06\u0C38\u0C2A\u0C24\u0C4D\u0C30\u0C2E\u0C41\u0C32\u0C41",
    S.campPartnerHospital to "\u0C15\u0C3E\u0C02\u0C2A\u0C4D \u0C2D\u0C3E\u0C17\u0C38\u0C4D\u0C35\u0C3E\u0C2E\u0C3F",
    S.conductedCampsCount to "%d \u0C38\u0C4D\u0C15\u0C42\u0C32\u0C4D \u0C15\u0C3E\u0C02\u0C2A\u0C4D\u200C\u0C32\u0C41 \u0C28\u0C3F\u0C30\u0C35\u0C39\u0C3F\u0C02\u0C1A\u0C3F\u0C30\u0C3F",
    S.viewByHospital to "\u0C06\u0C38\u0C2A\u0C24\u0C4D\u0C30\u0C02 \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E",
    S.viewBySpecialty to "\u0C38\u0C3F\u0C2A\u0C47\u0C37\u0C24\u0C32 \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E",
    S.yourArea to "\u0C2E\u0C40 \u0C2A\u0C3F\u0C30\u0C3F\u0C35\u0C47\u0C36\u0C02",
    S.noHospitalsFound to "\u0C08 \u0C2A\u0C3F\u0C30\u0C3F\u0C35\u0C47\u0C36\u0C02\u0C32\u0C4B \u0C06\u0C38\u0C2A\u0C24\u0C4D\u0C30\u0C2E\u0C41\u0C32\u0C41 \u0C32\u0C47\u0C35\u0C41",
    S.kmAway to "%s \u0C15\u0C3F.\u0C2E\u0C40 \u0C26\u0C42\u0C30\u0C02",
    S.useMyLocation to "\u0C28\u0C3E \u0C38\u0C4D\u0C25\u0C3E\u0C28\u0C02 \u0C09\u0C2A\u0C2F\u0C4B\u0C17\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.locationSorted to "\u0C2E\u0C40 \u0C26\u0C17\u0C4D\u0C17\u0C30\u0C3F\u0C28\u0C41\u0C02\u0C21\u0C3F \u0C26\u0C42\u0C30\u0C02 \u0C05\u0C28\u0C41\u0C17\u0C41\u0C23\u0C02\u0C17\u0C3E \u0C15\u0C4D\u0C30\u0C2E\u0C02\u0C2D\u0C02",
    S.hospitalPartnersSub to "\u0C2E\u0C40 \u0C38\u0C4D\u0C25\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C06\u0C38\u0C41\u0C2A\u0C24\u0C4D\u0C30 \u0C2D\u0C3E\u0C17\u0C38\u0C4D\u0C35\u0C3E\u0C2E\u0C3F\u0C32\u0C41 \u2014 \u0C15\u0C3E\u0C02\u0C2A\u0C4D \u0C2D\u0C3E\u0C17\u0C38\u0C4D\u0C35\u0C3E\u0C2E\u0C3F\u0C32\u0C41 \u0C2E\u0C41\u0C02\u0C26\u0C41",
    S.selectKid to "\u0C0F \u0C2A\u0C3F\u0C32\u0C4D\u0C32\u0C15\u0C4B\u0C38\u0C02?",
    S.selectDate to "\u0C24\u0C47\u0C26\u0C40 \u0C0E\u0C02\u0C1A\u0C41\u0C15\u0C4B\u0C02\u0C21\u0C3F",
    S.selectTime to "\u0C38\u0C2E\u0C2F\u0C3E\u0C28\u0C4D\u0C28\u0C3F \u0C0E\u0C02\u0C1A\u0C41\u0C15\u0C4B\u0C02\u0C21\u0C3F",
    S.confirmBooking to "\u0C2C\u0C41\u0C15\u0C3F\u0C02\u0C17\u0C4D \u0C28\u0C3F\u0C30\u0C4D\u0C27\u0C3E\u0C30\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.cancelAppt to "\u0C05\u0C2A\u0C3E\u0C2F\u0C3F\u0C02\u0C1F\u0C4D\u200C\u0C2E\u0C46\u0C02\u0C1F\u0C4D \u0C30\u0C26\u0C4D\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.yourAppts to "\u0C2E\u0C40 \u0C05\u0C2A\u0C3E\u0C2F\u0C3F\u0C02\u0C1F\u0C4D\u200C\u0C2E\u0C46\u0C02\u0C1F\u0C4D\u0C32\u0C41",
    S.disclaimer to "\u0C38\u0C2E\u0C3E\u0C1A\u0C3E\u0C30\u0C02 \u0C15\u0C4B\u0C38\u0C02 \u0C2E\u0C3E\u0C24\u0C4D\u0C30\u0C2E\u0C47. \u0C35\u0C48\u0C26\u0C4D\u0C2F \u0C38\u0C32\u0C39\u0C3E \u0C15\u0C4B\u0C38\u0C02 \u0C0E\u0C32\u0C4D\u0C32\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C42 \u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D\u200C\u0C28\u0C3F \u0C38\u0C02\u0C2A\u0C4D\u0C30\u0C26\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
    S.version to "\u0C35\u0C40\u0C1F\u0C3E\u0C39\u0C40\u0C30\u0C4B v1.0",
    S.back to "\u0C35\u0C46\u0C28\u0C15\u0C4D\u0C15\u0C3F",
    S.save to "\u0C38\u0C47\u0C35\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.cancel to "\u0C30\u0C26\u0C4D\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.ok to "\u0C38\u0C30\u0C47",
    S.wearableTitle to "\u0C39\u0C46\u0C32\u0C4D\u0C24\u0C4D \u0C15\u0C28\u0C46\u0C15\u0C4D\u0C1F\u0C4D",
    S.wearableSub to "\u0C2E\u0C40 \u0C2A\u0C3F\u0C32\u0C4D\u0C32 \u0C2A\u0C30\u0C3F\u0C15\u0C30\u0C02 \u0C28\u0C41\u0C02\u0C21\u0C3F \u0C38\u0C4D\u0C1F\u0C46\u0C2A\u0C4D\u200C\u0C32 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C2F\u0C3E\u0C15\u0C4D\u0C1F\u0C3F\u0C35\u0C3F\u0C1F\u0C40 \u0C21\u0C47\u0C1F\u0C3E\u0C28\u0C41 \u0C38\u0C3F\u0C02\u0C15\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.connectHealth to "\u0C39\u0C46\u0C32\u0C4D\u0C24\u0C4D \u0C21\u0C47\u0C1F\u0C3E\u0C28\u0C41 \u0C15\u0C28\u0C46\u0C15\u0C4D\u0C1F\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
    S.stepsToday to "\u0C08\u0C30\u0C4B\u0C1C\u0C41 \u0C05\u0C21\u0C41\u0C17\u0C41\u0C32\u0C41",
    S.activeMinutes to "\u0C2F\u0C3E\u0C15\u0C4D\u0C1F\u0C3F\u0C35\u0C4D \u0C28\u0C3F\u0C2E\u0C3F\u0C37\u0C3E\u0C32\u0C41",
    S.syncedFrom to "\u0C2A\u0C30\u0C3F\u0C15\u0C30\u0C02 \u0C28\u0C41\u0C02\u0C21\u0C3F \u0C38\u0C3F\u0C02\u0C15\u0C4D",
    S.syncFailed to "\u0C21\u0C47\u0C1F\u0C3E\u0C28\u0C41 \u0C38\u0C47\u0C35\u0C4D \u0C1A\u0C47\u0C2F\u0C32\u0C47\u0C2E\u0C41\u0C02\u0C26\u0C32\u0C47\u0C26\u0C41\u0964 \u0C26\u0C2F\u0C1A\u0C47\u0C38\u0C3F \u0C2E\u0C33\u0C4D\u0C32\u0C40 \u0C2A\u0C4D\u0C30\u0C2F\u0C24\u0C4D\u0C28\u0C02\u0C1A\u0C02\u0C21\u0C3F\u0964",
    S.familyInvalid to "\u0C15\u0C41\u0C1F\u0C41\u0C02\u0C2C \u0C15\u0C4B\u0C21\u0C4D \u0C15\u0C28\u0C41\u0C17\u0C4B\u0C28\u0C02\u0C32\u0C47\u0C26\u0C41\u0964 \u0C15\u0C4B\u0C21\u0C4D \u0C24\u0C2A\u0C4D\u0C2A\u0C3F\u0C02\u0C1A\u0C3F \u0C1A\u0C42\u0C21\u0C02\u0C21\u0C3F\u0964",
    S.noFamilyCodeYet to "\u0C38\u0C39-\u0C24\u0C32\u0C4D\u0C32\u0C3F\u0C28\u0C3F \u0C06\u0C39\u0C4D\u0C35\u0C3E\u0C28\u0C3F\u0C02\u0C1A\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C15\u0C41\u0C1F\u0C41\u0C02\u0C2C \u0C15\u0C4B\u0C21\u0C4D \u0C38\u0C3E\u0C27\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F\u0964",
    S.generateFamilyCode to "\u0C15\u0C41\u0C1F\u0C41\u0C02\u0C2C \u0C15\u0C4B\u0C21\u0C4D \u0C38\u0C3E\u0C27\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.todayLabel to "\u0C08\u0C30\u0C4B\u0C1C\u0C41",
    S.tomorrowLabel to "\u0C05\u0C2E\u0C3E\u0C30\u0C3E\u0C1F",
    S.linkedHospitalsSub to "Partner hospitals near you — camp partners shown first",
    S.privacyDataSub to "DPDP \u0C05\u0C28\u0C41\u0C2A\u0C3E\u0C32\u0C28 \u00B7 \u0C24\u0C02\u0C21\u0C4D\u0C30\u0C3F \u0C05\u0C02\u0C17\u0C40\u0C15\u0C30\u0C23",
    S.helpSupportSub to "\u0C38\u0C39\u0C3E\u0C2F\u0C02 \u0C1F\u0C40\u0C02\u0C15\u0C41 \u0C08\u0C2E\u0C47\u0C2F\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F",
    S.backLabel to "\u0C35\u0C46\u0C28\u0C41\u0C15\u0C15\u0C41",
    S.closeLabel to "\u0C2E\u0C42\u0C38\u0C3F\u0C35\u0C47\u0C2F\u0C3F",
    S.cancelLabel to "\u0C30\u0C26\u0C4D\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C3F",
    S.viewLabel to "\u0C1A\u0C42\u0C21\u0C02\u0C21\u0C3F",
    S.loadingLabel to "\u0C32\u0C4B\u0C21\u0C4D \u0C05\u0C35\u0C41\u0C24\u0C4B\u0C02\u0C26\u0C3F\u2026",
    S.you to "\u0C2E\u0C40\u0C30\u0C41",
    S.theSchool to "\u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32",
    S.campConsentTitle to "\u0C05\u0C28\u0C41\u0C2E\u0C24\u0C3F",
    S.campConsentSub to "\u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21\u0C28\u0C41 \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37\u0C3F\u0C02\u0C1A\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32 \u0C05\u0C28\u0C41\u0C2E\u0C24\u0C3F \u0C05\u0C21\u0C41\u0C17\u0C41\u0C24\u0C4B\u0C02\u0C26\u0C3F",
    S.noConsentPending to "\u0C38\u0C2E\u0C3E\u0C27\u0C3E\u0C28\u0C02 \u0C07\u0C35\u0C4D\u0C35\u0C3E\u0C32\u0C4D\u0C38\u0C3F\u0C28\u0C26\u0C3F \u0C0F\u0C26\u0C40 \u0C32\u0C47\u0C26\u0C41",
    S.noConsentPendingSub to "\u0C2E\u0C40\u0C30\u0C41 \u0C05\u0C28\u0C4D\u0C28\u0C3F \u0C05\u0C2D\u0C4D\u0C2F\u0C30\u0C4D\u0C25\u0C28\u0C32\u0C15\u0C41 \u0C38\u0C2E\u0C3E\u0C27\u0C3E\u0C28\u0C02 \u0C07\u0C1A\u0C4D\u0C1A\u0C3E\u0C30\u0C41. \u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32 \u0C2E\u0C33\u0C4D\u0C32\u0C40 \u0C05\u0C21\u0C3F\u0C17\u0C3F\u0C28\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C41 \u0C2E\u0C47\u0C2E\u0C41 \u0C2E\u0C40\u0C15\u0C41 \u0C24\u0C46\u0C32\u0C3F\u0C2F\u0C1C\u0C47\u0C38\u0C4D\u0C24\u0C3E\u0C2E\u0C41.",
    S.consentChecksTitle to "\u0C0F\u0C2E\u0C3F \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37\u0C3F\u0C38\u0C4D\u0C24\u0C3E\u0C30\u0C41",
    S.consentChecksHint to "\u0C2E\u0C40\u0C15\u0C41 \u0C35\u0C26\u0C4D\u0C26\u0C28\u0C41\u0C15\u0C41\u0C28\u0C4D\u0C28\u0C26\u0C3E\u0C28\u0C4D\u0C28\u0C3F \u0C24\u0C40\u0C38\u0C3F\u0C35\u0C47\u0C2F\u0C02\u0C21\u0C3F. \u0C2E\u0C3F\u0C17\u0C24\u0C3E \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37\u0C32\u0C41 \u0C2E\u0C3E\u0C2E\u0C42\u0C32\u0C41\u0C17\u0C3E\u0C28\u0C47 \u0C1C\u0C30\u0C41\u0C17\u0C41\u0C24\u0C3E\u0C2F\u0C3F.",
    S.consentGrant to "\u0C05\u0C35\u0C41\u0C28\u0C41, \u0C1A\u0C47\u0C2F\u0C35\u0C1A\u0C4D\u0C1A\u0C41",
    S.campConsentDecline to "\u0C35\u0C26\u0C4D\u0C26\u0C41, \u0C08\u0C38\u0C3E\u0C30\u0C3F \u0C15\u0C3E\u0C26\u0C41",
    S.consentDeadlineMsg to "\u0C26\u0C2F\u0C1A\u0C47\u0C38\u0C3F %s \u0C32\u0C4B\u0C2A\u0C41 \u0C38\u0C2E\u0C3E\u0C27\u0C3E\u0C28\u0C02 \u0C07\u0C35\u0C4D\u0C35\u0C02\u0C21\u0C3F.",
    S.consentChangeMind to "\u0C2E\u0C40\u0C30\u0C41 \u0C0E\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C48\u0C28\u0C3E \u0C2E\u0C40 \u0C28\u0C3F\u0C30\u0C4D\u0C23\u0C2F\u0C3E\u0C28\u0C4D\u0C28\u0C3F \u0C2E\u0C3E\u0C30\u0C4D\u0C1A\u0C41\u0C15\u0C4B\u0C35\u0C1A\u0C4D\u0C1A\u0C41 \u2014 \u0C36\u0C3F\u0C2C\u0C3F\u0C30\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C2E\u0C41\u0C02\u0C26\u0C41 \u0C32\u0C47\u0C26\u0C3E \u0C24\u0C30\u0C4D\u0C35\u0C3E\u0C24.",
    S.consentRecordedYes to "\u0C27\u0C28\u0C4D\u0C2F\u0C35\u0C3E\u0C26\u0C3E\u0C32\u0C41. \u0C2E\u0C40 \u0C05\u0C28\u0C41\u0C2E\u0C24\u0C3F \u0C28\u0C2E\u0C4B\u0C26\u0C48\u0C02\u0C26\u0C3F.",
    S.consentRecordedNo to "\u0C28\u0C2E\u0C4B\u0C26\u0C48\u0C02\u0C26\u0C3F. \u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21\u0C28\u0C41 \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37\u0C3F\u0C02\u0C1A\u0C30\u0C41.",
    S.consentFailed to "\u0C2E\u0C47\u0C2E\u0C41 \u0C26\u0C3E\u0C28\u0C3F\u0C28\u0C3F \u0C28\u0C2E\u0C4B\u0C26\u0C41 \u0C1A\u0C47\u0C2F\u0C32\u0C47\u0C15\u0C2A\u0C4B\u0C2F\u0C3E\u0C2E\u0C41. \u0C26\u0C2F\u0C1A\u0C47\u0C38\u0C3F \u0C2E\u0C33\u0C4D\u0C32\u0C40 \u0C2A\u0C4D\u0C30\u0C2F\u0C24\u0C4D\u0C28\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
    S.photoConsentTitle to "\u0C2B\u0C4B\u0C1F\u0C4B\u0C32\u0C41",
    S.photoConsentBody to "\u0C08 \u0C36\u0C3F\u0C2C\u0C3F\u0C30\u0C02\u0C32\u0C4B \u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D \u0C15\u0C28\u0C3F\u0C2A\u0C3F\u0C02\u0C1A\u0C3F\u0C28 \u0C26\u0C3E\u0C28\u0C3F\u0C28\u0C3F \u0C2B\u0C4B\u0C1F\u0C4B \u0C24\u0C40\u0C2F\u0C3E\u0C32\u0C28\u0C41\u0C15\u0C4B\u0C35\u0C1A\u0C4D\u0C1A\u0C41 \u2014 \u0C26\u0C26\u0C4D\u0C26\u0C41\u0C30\u0C4D\u0C32\u0C41 \u0C32\u0C47\u0C26\u0C3E \u0C15\u0C28\u0C4D\u0C28\u0C41. \u0C07\u0C26\u0C3F \u0C35\u0C47\u0C30\u0C47 \u0C2A\u0C4D\u0C30\u0C36\u0C4D\u0C28. \u0C2E\u0C40\u0C30\u0C41 \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37\u0C15\u0C41 \u0C05\u0C35\u0C41\u0C28\u0C41 \u0C05\u0C28\u0C3F, \u0C2B\u0C4B\u0C1F\u0C4B\u0C32\u0C15\u0C41 \u0C35\u0C26\u0C4D\u0C26\u0C28\u0C3F \u0C1A\u0C46\u0C2A\u0C4D\u0C2A\u0C35\u0C1A\u0C4D\u0C1A\u0C41.",
    S.photoConsentAgree to "\u0C2B\u0C4B\u0C1F\u0C4B\u0C32\u0C41 \u0C24\u0C40\u0C2F\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C05\u0C28\u0C41\u0C2E\u0C24\u0C3F \u0C09\u0C02\u0C26\u0C3F",
    S.campResultTitle to "\u0C36\u0C3F\u0C2C\u0C3F\u0C30 \u0C2B\u0C32\u0C3F\u0C24\u0C02",
    S.resultUnderReview to "\u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D \u0C07\u0C02\u0C15\u0C3E \u0C26\u0C40\u0C28\u0C4D\u0C28\u0C3F \u0C1A\u0C42\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C30\u0C41",
    S.resultUnderReviewSub to "\u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D \u0C1A\u0C42\u0C38\u0C47 \u0C35\u0C30\u0C15\u0C41 \u0C0F\u0C26\u0C40 \u0C1A\u0C42\u0C2A\u0C2C\u0C21\u0C26\u0C41. \u0C35\u0C3E\u0C30\u0C41 \u0C2A\u0C42\u0C30\u0C4D\u0C24\u0C3F \u0C1A\u0C47\u0C38\u0C3F\u0C28 \u0C24\u0C30\u0C4D\u0C35\u0C3E\u0C24 \u0C07\u0C26\u0C3F \u0C07\u0C15\u0C4D\u0C15\u0C21 \u0C15\u0C28\u0C3F\u0C2A\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C02\u0C26\u0C3F.",
    S.doctorSays to "\u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D \u0C38\u0C32\u0C39\u0C3E",
    S.photosTitle to "\u0C2B\u0C4B\u0C1F\u0C4B\u0C32\u0C41",
    S.photosSub to "\u0C2E\u0C40 \u0C05\u0C28\u0C41\u0C2E\u0C24\u0C3F\u0C24\u0C4B \u0C24\u0C40\u0C38\u0C3F\u0C28\u0C35\u0C3F. \u0C35\u0C40\u0C1F\u0C3F\u0C28\u0C3F \u0C36\u0C3F\u0C2C\u0C3F\u0C30 \u0C35\u0C48\u0C26\u0C4D\u0C2F \u0C2C\u0C43\u0C02\u0C26\u0C02 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C2E\u0C40\u0C30\u0C41 \u0C2E\u0C3E\u0C24\u0C4D\u0C30\u0C2E\u0C47 \u0C1A\u0C42\u0C21\u0C17\u0C32\u0C30\u0C41.",
    S.photoUnavailable to "\u0C08 \u0C2B\u0C4B\u0C1F\u0C4B\u0C28\u0C41 \u0C24\u0C46\u0C30\u0C35\u0C32\u0C47\u0C15\u0C2A\u0C4B\u0C2F\u0C3E\u0C2E\u0C41.",
    S.questionsTitle to "\u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32\u0C28\u0C41 \u0C05\u0C21\u0C17\u0C02\u0C21\u0C3F",
    S.questionsSub to "\u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21 \u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37 \u0C17\u0C41\u0C30\u0C3F\u0C02\u0C1A\u0C3F",
    S.questionsClosed to "\u0C2A\u0C4D\u0C30\u0C38\u0C4D\u0C24\u0C41\u0C24\u0C02 \u0C2A\u0C4D\u0C30\u0C36\u0C4D\u0C28\u0C32\u0C41 \u0C38\u0C4D\u0C35\u0C40\u0C15\u0C30\u0C3F\u0C02\u0C1A\u0C21\u0C02 \u0C32\u0C47\u0C26\u0C41",
    S.questionsClosedSub to "\u0C2E\u0C40 \u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32 \u0C2A\u0C4D\u0C30\u0C38\u0C4D\u0C24\u0C41\u0C24\u0C02 \u0C2F\u0C3E\u0C2A\u0C4D \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E \u0C2A\u0C4D\u0C30\u0C36\u0C4D\u0C28\u0C32\u0C15\u0C41 \u0C38\u0C2E\u0C3E\u0C27\u0C3E\u0C28\u0C02 \u0C07\u0C35\u0C4D\u0C35\u0C21\u0C02 \u0C32\u0C47\u0C26\u0C41. \u0C26\u0C2F\u0C1A\u0C47\u0C38\u0C3F \u0C28\u0C47\u0C30\u0C41\u0C17\u0C3E \u0C38\u0C02\u0C2A\u0C4D\u0C30\u0C26\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
    S.questionsNoticeFallback to "\u0C07\u0C26\u0C3F \u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21 \u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32 \u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37\u0C15\u0C41 \u0C38\u0C02\u0C2C\u0C02\u0C27\u0C3F\u0C02\u0C1A\u0C3F\u0C28 \u0C2A\u0C4D\u0C30\u0C36\u0C4D\u0C28\u0C32 \u0C15\u0C4B\u0C38\u0C02. \u0C26\u0C40\u0C28\u0C4D\u0C28\u0C3F \u0C30\u0C4B\u0C1C\u0C02\u0C24\u0C3E \u0C1A\u0C42\u0C21\u0C30\u0C41, \u0C05\u0C24\u0C4D\u0C2F\u0C35\u0C38\u0C30 \u0C35\u0C3F\u0C37\u0C2F\u0C3E\u0C32\u0C15\u0C41 \u0C26\u0C40\u0C28\u0C4D\u0C28\u0C3F \u0C35\u0C3E\u0C21\u0C15\u0C42\u0C21\u0C26\u0C41. \u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21\u0C15\u0C41 \u0C07\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C41 \u0C05\u0C28\u0C3E\u0C30\u0C4B\u0C17\u0C4D\u0C2F\u0C02\u0C17\u0C3E \u0C09\u0C02\u0C1F\u0C47, \u0C2E\u0C40 \u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D\u200C\u0C15\u0C41 \u0C2B\u0C4B\u0C28\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F \u0C32\u0C47\u0C26\u0C3E \u0C06\u0C38\u0C41\u0C2A\u0C24\u0C4D\u0C30\u0C3F\u0C15\u0C3F \u0C35\u0C46\u0C33\u0C4D\u0C32\u0C02\u0C21\u0C3F.",
    S.yourQuestions to "\u0C2E\u0C40 \u0C2A\u0C4D\u0C30\u0C36\u0C4D\u0C28\u0C32\u0C41",
    S.askTheSchool to "\u0C12\u0C15 \u0C2A\u0C4D\u0C30\u0C36\u0C4D\u0C28 \u0C05\u0C21\u0C17\u0C02\u0C21\u0C3F",
    S.replyWithinDays to "\u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32 %s \u0C30\u0C4B\u0C1C\u0C41\u0C32\u0C4D\u0C32\u0C4B \u0C38\u0C2E\u0C3E\u0C27\u0C3E\u0C28\u0C02 \u0C07\u0C35\u0C4D\u0C35\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C2A\u0C4D\u0C30\u0C2F\u0C24\u0C4D\u0C28\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C02\u0C26\u0C3F.",
    S.aboutWhichChild to "\u0C0F \u0C2C\u0C3F\u0C21\u0C4D\u0C21 \u0C17\u0C41\u0C30\u0C3F\u0C02\u0C1A\u0C3F?",
    S.questionPlaceholder to "\u0C2E\u0C40 \u0C2A\u0C4D\u0C30\u0C36\u0C4D\u0C28\u0C28\u0C41 \u0C07\u0C15\u0C4D\u0C15\u0C21 \u0C30\u0C3E\u0C2F\u0C02\u0C21\u0C3F",
    S.notUrgentAck to "\u0C07\u0C26\u0C3F \u0C05\u0C24\u0C4D\u0C2F\u0C35\u0C38\u0C30 \u0C2A\u0C30\u0C3F\u0C38\u0C4D\u0C25\u0C3F\u0C24\u0C41\u0C32 \u0C15\u0C4B\u0C38\u0C02 \u0C15\u0C3E\u0C26\u0C28\u0C3F \u0C28\u0C47\u0C28\u0C41 \u0C05\u0C30\u0C4D\u0C25\u0C02 \u0C1A\u0C47\u0C38\u0C41\u0C15\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C28\u0C41, \u0C28\u0C3E \u0C2C\u0C3F\u0C21\u0C4D\u0C21\u0C15\u0C41 \u0C07\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C41 \u0C38\u0C3E\u0C2F\u0C02 \u0C05\u0C35\u0C38\u0C30\u0C2E\u0C48\u0C24\u0C47 \u0C28\u0C47\u0C28\u0C41 \u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D\u200C\u0C15\u0C41 \u0C2B\u0C4B\u0C28\u0C4D \u0C1A\u0C47\u0C38\u0C4D\u0C24\u0C3E\u0C28\u0C41.",
    S.sendQuestion to "\u0C2A\u0C4D\u0C30\u0C36\u0C4D\u0C28 \u0C2A\u0C02\u0C2A\u0C02\u0C21\u0C3F",
    S.awaitingSchool to "\u0C38\u0C2E\u0C3E\u0C27\u0C3E\u0C28\u0C02 \u0C15\u0C4B\u0C38\u0C02 \u0C0E\u0C26\u0C41\u0C30\u0C41 \u0C1A\u0C42\u0C38\u0C4D\u0C24\u0C4B\u0C02\u0C26\u0C3F",
    S.schoolReplied to "\u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32 \u0C38\u0C2E\u0C3E\u0C27\u0C3E\u0C28\u0C02 \u0C07\u0C1A\u0C4D\u0C1A\u0C3F\u0C02\u0C26\u0C3F",
    S.questionSentMsg to "\u0C2A\u0C02\u0C2A\u0C2C\u0C21\u0C3F\u0C02\u0C26\u0C3F. \u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32 %s \u0C30\u0C4B\u0C1C\u0C41\u0C32\u0C4D\u0C32\u0C4B \u0C38\u0C2E\u0C3E\u0C27\u0C3E\u0C28\u0C02 \u0C07\u0C35\u0C4D\u0C35\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C2A\u0C4D\u0C30\u0C2F\u0C24\u0C4D\u0C28\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C02\u0C26\u0C3F.",
    S.questionFailed to "\u0C2E\u0C47\u0C2E\u0C41 \u0C26\u0C3E\u0C28\u0C3F\u0C28\u0C3F \u0C2A\u0C02\u0C2A\u0C32\u0C47\u0C15\u0C2A\u0C4B\u0C2F\u0C3E\u0C2E\u0C41. \u0C26\u0C2F\u0C1A\u0C47\u0C38\u0C3F \u0C2E\u0C33\u0C4D\u0C32\u0C40 \u0C2A\u0C4D\u0C30\u0C2F\u0C24\u0C4D\u0C28\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
    S.libraryTitle to "\u0C1A\u0C26\u0C35\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F",
    S.librarySub to "\u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21 \u0C2B\u0C32\u0C3F\u0C24\u0C3E\u0C32 \u0C06\u0C27\u0C3E\u0C30\u0C02\u0C17\u0C3E \u0C0E\u0C02\u0C2A\u0C3F\u0C15 \u0C1A\u0C47\u0C2F\u0C2C\u0C21\u0C3F\u0C02\u0C26\u0C3F",
    S.forYourFamily to "\u0C2E\u0C40 \u0C15\u0C41\u0C1F\u0C41\u0C02\u0C2C\u0C02 \u0C15\u0C4B\u0C38\u0C02",
    S.generalReading to "\u0C05\u0C02\u0C26\u0C30\u0C3F \u0C15\u0C4B\u0C38\u0C02",
    S.becauseOfFinding to "%s1 \u0C2F\u0C4A\u0C15\u0C4D\u0C15 %s2 \u0C2B\u0C32\u0C3F\u0C24\u0C02 \u0C15\u0C3E\u0C30\u0C23\u0C02\u0C17\u0C3E",
    S.libraryEmpty to "\u0C07\u0C02\u0C15\u0C3E \u0C1A\u0C26\u0C35\u0C21\u0C3E\u0C28\u0C3F\u0C15\u0C3F \u0C0F\u0C26\u0C40 \u0C32\u0C47\u0C26\u0C41",
    S.libraryDisclaimer to "\u0C07\u0C26\u0C3F \u0C38\u0C3E\u0C27\u0C3E\u0C30\u0C23 \u0C38\u0C32\u0C39\u0C3E, \u0C30\u0C4B\u0C17 \u0C28\u0C3F\u0C30\u0C4D\u0C27\u0C3E\u0C30\u0C23 \u0C15\u0C3E\u0C26\u0C41. \u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21 \u0C17\u0C41\u0C30\u0C3F\u0C02\u0C1A\u0C3F \u0C06\u0C02\u0C26\u0C4B\u0C33\u0C28\u0C17\u0C3E \u0C09\u0C02\u0C1F\u0C47 \u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D\u200C\u0C28\u0C41 \u0C15\u0C32\u0C35\u0C02\u0C21\u0C3F.",
    S.referralsTitle to "\u0C24\u0C26\u0C41\u0C2A\u0C30\u0C3F \u0C1A\u0C30\u0C4D\u0C2F",
    S.referralsSub to "\u0C36\u0C3F\u0C2C\u0C3F\u0C30\u0C02 \u0C24\u0C30\u0C4D\u0C35\u0C3E\u0C24 \u0C0F\u0C02 \u0C1A\u0C47\u0C2F\u0C3E\u0C32\u0C3F",
    S.noReferrals to "\u0C24\u0C26\u0C41\u0C2A\u0C30\u0C3F \u0C1A\u0C30\u0C4D\u0C2F \u0C0F\u0C26\u0C40 \u0C32\u0C47\u0C26\u0C41",
    S.noReferralsSub to "\u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21\u0C28\u0C41 \u0C0E\u0C15\u0C4D\u0C15\u0C21\u0C3F\u0C15\u0C40 \u0C24\u0C40\u0C38\u0C41\u0C15\u0C41\u0C35\u0C46\u0C33\u0C4D\u0C32\u0C2E\u0C28\u0C3F \u0C0F \u0C21\u0C3E\u0C15\u0C4D\u0C1F\u0C30\u0C4D \u0C1A\u0C46\u0C2A\u0C4D\u0C2A\u0C32\u0C47\u0C26\u0C41.",
    S.referralDueBy to "%s \u0C32\u0C4B\u0C2A\u0C41 \u0C1A\u0C47\u0C2F\u0C21\u0C02 \u0C2E\u0C02\u0C1A\u0C3F\u0C26\u0C3F.",
    S.referralBooked to "\u0C28\u0C47\u0C28\u0C41 \u0C05\u0C2A\u0C3E\u0C2F\u0C3F\u0C02\u0C1F\u0C4D\u200C\u0C2E\u0C46\u0C02\u0C1F\u0C4D \u0C24\u0C40\u0C38\u0C41\u0C15\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C28\u0C41",
    S.referralAttended to "\u0C2E\u0C47\u0C2E\u0C41 \u0C35\u0C46\u0C33\u0C4D\u0C32\u0C3E\u0C2E\u0C41, \u0C2A\u0C42\u0C30\u0C4D\u0C24\u0C2F\u0C3F\u0C02\u0C26\u0C3F",
    S.referralNotGoing to "\u0C2E\u0C47\u0C2E\u0C41 \u0C26\u0C40\u0C28\u0C4D\u0C28\u0C3F \u0C1A\u0C47\u0C2F\u0C3F\u0C02\u0C1A\u0C2E\u0C41",
    S.referralClosed to "\u0C2E\u0C41\u0C17\u0C3F\u0C38\u0C3F\u0C02\u0C26\u0C3F",
    S.referralUpdateFailed to "\u0C2E\u0C47\u0C2E\u0C41 \u0C26\u0C3E\u0C28\u0C3F\u0C28\u0C3F \u0C38\u0C47\u0C35\u0C4D \u0C1A\u0C47\u0C2F\u0C32\u0C47\u0C15\u0C2A\u0C4B\u0C2F\u0C3E\u0C2E\u0C41. \u0C26\u0C2F\u0C1A\u0C47\u0C38\u0C3F \u0C2E\u0C33\u0C4D\u0C32\u0C40 \u0C2A\u0C4D\u0C30\u0C2F\u0C24\u0C4D\u0C28\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
    S.urgencyUrgent to "\u0C05\u0C24\u0C4D\u0C2F\u0C35\u0C38\u0C30\u0C02",
    S.urgencySoon to "\u0C24\u0C4D\u0C35\u0C30\u0C32\u0C4B",
    S.urgencyRoutine to "\u0C35\u0C40\u0C32\u0C48\u0C28\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C41",
    S.privacyTitle to "\u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21 \u0C30\u0C3F\u0C15\u0C3E\u0C30\u0C4D\u0C21\u0C41",
    S.privacySub to "\u0C0F\u0C2E\u0C3F \u0C09\u0C02\u0C1A\u0C2C\u0C21\u0C41\u0C24\u0C41\u0C02\u0C26\u0C3F, \u0C26\u0C3E\u0C28\u0C3F \u0C17\u0C41\u0C30\u0C3F\u0C02\u0C1A\u0C3F \u0C2E\u0C40\u0C30\u0C41 \u0C0F\u0C2E\u0C3F \u0C1A\u0C47\u0C2F\u0C35\u0C1A\u0C4D\u0C1A\u0C41",
    S.careIsFreeTitle to "\u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F \u0C2B\u0C32\u0C3F\u0C24\u0C3E\u0C32\u0C41 \u0C09\u0C1A\u0C3F\u0C24\u0C02",
    S.careIsFreeBody to "\u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21 \u0C06\u0C30\u0C4B\u0C17\u0C4D\u0C2F \u0C2B\u0C32\u0C3F\u0C24\u0C3E\u0C32\u0C41, \u0C24\u0C26\u0C41\u0C2A\u0C30\u0C3F \u0C1A\u0C30\u0C4D\u0C2F\u0C32\u0C41 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C30\u0C3F\u0C15\u0C3E\u0C30\u0C4D\u0C21\u0C41\u0C32\u0C41 \u0C09\u0C1A\u0C3F\u0C24\u0C02, \u0C0E\u0C2A\u0C4D\u0C2A\u0C1F\u0C3F\u0C15\u0C40 \u0C09\u0C1A\u0C3F\u0C24\u0C2E\u0C47. \u0C1A\u0C46\u0C32\u0C4D\u0C32\u0C3F\u0C02\u0C2A\u0C41 \u0C2A\u0C4D\u0C32\u0C3E\u0C28\u0C4D \u0C15\u0C47\u0C35\u0C32\u0C02 \u0C38\u0C4C\u0C15\u0C30\u0C4D\u0C2F\u0C3E\u0C32\u0C28\u0C41 \u0C2E\u0C3E\u0C24\u0C4D\u0C30\u0C2E\u0C47 \u0C1C\u0C4B\u0C21\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C02\u0C26\u0C3F.",
    S.withdrawTitle to "\u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32 \u0C15\u0C3E\u0C30\u0C4D\u0C2F\u0C15\u0C4D\u0C30\u0C2E\u0C02 \u0C28\u0C41\u0C02\u0C21\u0C3F \u0C35\u0C48\u0C26\u0C4A\u0C32\u0C17\u0C02\u0C21\u0C3F",
    S.withdrawBody to "\u0C2D\u0C35\u0C3F\u0C37\u0C4D\u0C2F\u0C24\u0C4D\u0C24\u0C41\u0C32\u0C4B \u0C0F \u0C36\u0C3F\u0C2C\u0C3F\u0C30\u0C02\u0C32\u0C4B\u0C28\u0C42 \u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21\u0C28\u0C41 \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37\u0C3F\u0C02\u0C1A\u0C30\u0C41. \u0C07\u0C2A\u0C4D\u0C2A\u0C1F\u0C3F\u0C15\u0C47 \u0C35\u0C3F\u0C21\u0C41\u0C26\u0C32\u0C48\u0C28 \u0C2B\u0C32\u0C3F\u0C24\u0C3E\u0C32\u0C41 \u0C2E\u0C40 \u0C2F\u0C3E\u0C2A\u0C4D\u200C\u0C32\u0C4B \u0C09\u0C02\u0C1F\u0C3E\u0C2F\u0C3F, \u0C35\u0C3E\u0C1F\u0C3F\u0C28\u0C3F \u0C24\u0C4A\u0C32\u0C17\u0C3F\u0C02\u0C1A\u0C2E\u0C28\u0C3F \u0C2E\u0C40\u0C30\u0C41 \u0C0E\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C48\u0C28\u0C3E \u0C05\u0C21\u0C17\u0C35\u0C1A\u0C4D\u0C1A\u0C41.",
    S.withdrawAction to "\u0C35\u0C48\u0C26\u0C4A\u0C32\u0C17\u0C02\u0C21\u0C3F",
    S.withdrawReasonHint to "\u0C0E\u0C02\u0C26\u0C41\u0C15\u0C41? (\u0C10\u0C1A\u0C4D\u0C1B\u0C3F\u0C15\u0C02)",
    S.withdrawConfirm to "\u0C05\u0C35\u0C41\u0C28\u0C41, \u0C35\u0C48\u0C26\u0C4A\u0C32\u0C17\u0C41",
    S.consentWithdrawn to "\u0C35\u0C48\u0C26\u0C4A\u0C32\u0C3F\u0C17\u0C3E\u0C30\u0C41. \u0C2E\u0C40 \u0C2C\u0C3F\u0C21\u0C4D\u0C21\u0C28\u0C41 \u0C2E\u0C33\u0C4D\u0C32\u0C40 \u0C2A\u0C30\u0C40\u0C15\u0C4D\u0C37\u0C3F\u0C02\u0C1A\u0C30\u0C41.",
    S.consentWithdrawFailed to "\u0C2E\u0C47\u0C2E\u0C41 \u0C26\u0C40\u0C28\u0C4D\u0C28\u0C3F \u0C1A\u0C47\u0C2F\u0C32\u0C47\u0C15\u0C2A\u0C4B\u0C2F\u0C3E\u0C2E\u0C41. \u0C26\u0C2F\u0C1A\u0C47\u0C38\u0C3F \u0C2E\u0C33\u0C4D\u0C32\u0C40 \u0C2A\u0C4D\u0C30\u0C2F\u0C24\u0C4D\u0C28\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
    S.rightsHistoryTitle to "\u0C08 \u0C30\u0C3F\u0C15\u0C3E\u0C30\u0C4D\u0C21\u0C41\u0C15\u0C41 \u0C0F\u0C2E\u0C3F \u0C1C\u0C30\u0C3F\u0C17\u0C3F\u0C02\u0C26\u0C3F",
    S.rightsHistorySub to "\u0C2A\u0C4D\u0C30\u0C24\u0C3F \u0C0E\u0C17\u0C41\u0C2E\u0C24\u0C3F, \u0C38\u0C35\u0C30\u0C23 \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C09\u0C2A\u0C38\u0C02\u0C39\u0C30\u0C23, \u0C35\u0C30\u0C41\u0C38\u0C17\u0C3E.",
    S.correctionSent to "\u0C24\u0C28\u0C3F\u0C16\u0C40 \u0C15\u0C4B\u0C38\u0C02 \u0C2A\u0C3E\u0C20\u0C36\u0C3E\u0C32\u0C15\u0C41 \u0C2A\u0C02\u0C2A\u0C2C\u0C21\u0C3F\u0C02\u0C26\u0C3F.",
    S.correctionFailed to "\u0C2E\u0C47\u0C2E\u0C41 \u0C26\u0C3E\u0C28\u0C3F\u0C28\u0C3F \u0C2A\u0C02\u0C2A\u0C32\u0C47\u0C15\u0C2A\u0C4B\u0C2F\u0C3E\u0C2E\u0C41. \u0C26\u0C2F\u0C1A\u0C47\u0C38\u0C3F \u0C2E\u0C33\u0C4D\u0C32\u0C40 \u0C2A\u0C4D\u0C30\u0C2F\u0C24\u0C4D\u0C28\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F.",
)

private val allTranslations = mapOf(
    AppLocale.ENGLISH.code to en,
    AppLocale.HINDI.code to hi,
    AppLocale.TELUGU.code to te,
)

fun tr(key: String, locale: AppLocale): String {
    return allTranslations[locale.code]?.get(key) ?: en[key] ?: key
}

/**
 * Locale-aware string resolution for notifications and background tasks
 * that don't have access to the Compose-based S.* system.
 * Provides key-value lookup with English fallback for all supported locales.
 */
object LocaleStrings {

    private val notifEn = mapOf(
        "notif_camp_title" to "Camp Coming Up!",
        "notif_camp_body" to "{camp} is in 2 days. Get the kids ready!",
        "notif_checkup_title" to "Upcoming Appointment",
        "notif_checkup_body" to "{kid} has a checkup with {doctor} today at {time}",
        "notif_diet_title" to "Log {kid}'s Meals",
        "notif_diet_body" to "Don't forget to mark today's meals for {kid}. Keep the streak going!",
    )

    private val notifHi = mapOf(
        "notif_camp_title" to "\u0915\u0948\u0902\u092A \u0906\u0928\u0947 \u0935\u093E\u0932\u093E \u0939\u0948!",
        "notif_camp_body" to "{camp} 2 \u0926\u093F\u0928\u094B\u0902 \u092E\u0947\u0902 \u0939\u0948\u0964 \u092C\u091A\u094D\u091A\u094B\u0902 \u0915\u094B \u0924\u0948\u092F\u093E\u0930 \u0915\u0930\u0947\u0902!",
        "notif_checkup_title" to "\u0906\u0917\u093E\u092E\u0940 \u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F",
        "notif_checkup_body" to "{kid} \u0915\u0940 {doctor} \u0915\u0947 \u0938\u093E\u0925 \u0906\u091C {time} \u092C\u091C\u0947 \u091A\u0947\u0915\u0905\u092A \u0939\u0948",
        "notif_diet_title" to "{kid} \u0915\u093E \u0916\u093E\u0928\u093E \u0932\u0949\u0917 \u0915\u0930\u0947\u0902",
        "notif_diet_body" to "{kid} \u0915\u0947 \u0932\u093F\u090F \u0906\u091C \u0915\u093E \u0916\u093E\u0928\u093E \u092E\u093E\u0930\u094D\u0915 \u0915\u0930\u0928\u093E \u0928 \u092D\u0942\u0932\u0947\u0902\u0964 \u0938\u094D\u091F\u094D\u0930\u0940\u0915 \u091C\u093E\u0930\u0940 \u0930\u0916\u0947\u0902!",
    )

    private val notifTe = mapOf(
        "notif_camp_title" to "\u0C15\u0C4D\u0C2F\u0C3E\u0C02\u0C2A\u0C41 \u0C30\u0C3E\u0C2C\u0C4B\u0C24\u0C4B\u0C02\u0C26\u0C3F!",
        "notif_camp_body" to "{camp} 2 \u0C30\u0C4B\u0C1C\u0C41\u0C32\u0C4D\u0C32\u0C4B \u0C09\u0C02\u0C26\u0C3F. \u0C2A\u0C3F\u0C32\u0C4D\u0C32\u0C32\u0C28\u0C41 \u0C38\u0C3F\u0C26\u0C4D\u0C27\u0C02 \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F!",
        "notif_checkup_title" to "\u0C30\u0C3E\u0C2C\u0C4B\u0C2F\u0C47 \u0C05\u0C2A\u0C3E\u0C2F\u0C3F\u0C02\u0C1F\u0C4D\u200C\u0C2E\u0C46\u0C02\u0C1F\u0C4D",
        "notif_checkup_body" to "{kid} \u0C15\u0C3F {doctor} \u0C24\u0C4B \u0C08\u0C30\u0C4B\u0C1C\u0C41 {time} \u0C15\u0C3F \u0C1A\u0C46\u0C15\u0C2A\u0C4D \u0C09\u0C02\u0C26\u0C3F",
        "notif_diet_title" to "{kid} \u0C2D\u0C4B\u0C1C\u0C28\u0C3E\u0C28\u0C4D\u0C28\u0C3F \u0C32\u0C3E\u0C17\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F",
        "notif_diet_body" to "{kid} \u0C15\u0C4B\u0C38\u0C02 \u0C08\u0C30\u0C4B\u0C1C\u0C41 \u0C2D\u0C4B\u0C1C\u0C28\u0C3E\u0C28\u0C4D\u0C28\u0C3F \u0C17\u0C41\u0C30\u0C4D\u0C24\u0C3F\u0C02\u0C1A\u0C21\u0C02 \u0C2E\u0C30\u0C4D\u0C1A\u0C3F\u0C2A\u0C4B\u0C35\u0C26\u0C4D\u0C26\u0C41. \u0C38\u0C4D\u0C1F\u0C4D\u0C30\u0C40\u0C15\u0C4D \u0C15\u0C4A\u0C28\u0C38\u0C3E\u0C17\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F!",
    )

    private val notifStrings: Map<AppLocale, Map<String, String>> = mapOf(
        AppLocale.ENGLISH to notifEn,
        AppLocale.HINDI to notifHi,
        AppLocale.TELUGU to notifTe,
    )

    fun get(locale: AppLocale, key: String, fallback: String = ""): String {
        return notifStrings[locale]?.get(key) ?: notifStrings[AppLocale.ENGLISH]?.get(key) ?: fallback
    }
}
