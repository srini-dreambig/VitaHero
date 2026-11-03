package kallam.healthcare.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import kallam.healthcare.data.DetectedFood
import kallam.healthcare.data.FoodRecognitionService
import kallam.healthcare.data.GuardianViewModel
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SecondaryButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf
import kallam.healthcare.ui.components.tf2
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.HeroPurple
import kallam.healthcare.ui.theme.HeroYellow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoodRecognitionScreen(
    kidName: String,
    kidId: String,
    guardianViewModel: GuardianViewModel,
    onBack: () -> Unit,
    onLogDetectedFood: (String, String, Int) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    // Whether this child's meal photographs may leave the handset. Read once
    // on the way in; the card below asks if nobody has been asked yet.
    val mealConsent by guardianViewModel.mealPhotoConsent.collectAsState()
    val consent = mealConsent[kidId]
    LaunchedEffect(kidId) { guardianViewModel.loadMealPhotoConsent(kidId) }
    var isAnalyzing by remember { mutableStateOf(false) }
    var detectedItems by remember { mutableStateOf<List<DetectedFood>>(emptyList()) }
    var loggedItems by remember { mutableStateOf<Set<String>>(emptySet()) }
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) {
            Toast.makeText(context, "Camera permission needed for food recognition", Toast.LENGTH_SHORT).show()
        }
    }

    val captureLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null) {
            isAnalyzing = true
            detectedItems = emptyList()
            scope.launch {
                val results = withContext(Dispatchers.IO) {
                    // The guardian's answer decides whether this photograph
                    // leaves the phone. Without a yes it is labelled here, on
                    // the device, and the meal is still logged.
                    FoodRecognitionService.analyseBitmap(
                        bitmap,
                        kidId = kidId,
                        allowRemote = consent?.granted == true,
                    )
                }
                detectedItems = results
                isAnalyzing = false
            }
        }
    }

    fun onCaptureClick() {
        if (!hasCameraPermission) {
            cameraLauncher.launch(Manifest.permission.CAMERA)
        } else {
            captureLauncher.launch(null)
        }
    }

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(t(S.foodRecognition), onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl)
        ) {
            // The question, asked once, before the first photograph.
            //
            // Camp photographs have had a consent gate from the start; these
            // did not, and they are the ones taken in a family's own kitchen.
            // Both answers leave a working feature — that is the point, and it
            // is why the card says what each one means rather than pressing
            // for a yes.
            if (consent != null && !consent.asked) {
                item {
                    AppCard {
                        Text(
                            t(S.mealPhotoAskTitle),
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Spacer(Modifier.height(AppSpacing.sm))
                        Text(
                            t(S.mealPhotoAskBody),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(AppSpacing.md))
                        PrimaryGradientButton(
                            text = t(S.mealPhotoAllow),
                            onClick = { guardianViewModel.setMealPhotoConsent(kidId, true) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(AppSpacing.sm))
                        SecondaryButton(
                            text = t(S.mealPhotoKeepOnPhone),
                            onClick = { guardianViewModel.setMealPhotoConsent(kidId, false) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    Spacer(Modifier.height(AppSpacing.lg))
                }
            } else if (consent != null && !consent.granted) {
                item {
                    Text(
                        t(S.mealPhotoOnDevice),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(AppSpacing.md))
                }
            }

            item {
                Text(
                    tf(S.takePhotoOf, kidName),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(AppSpacing.xl))
            }

            // Capture button
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .clip(RoundedCornerShape(AppCorners.xlarge))
                        .background(if (isAnalyzing) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.secondaryContainer)
                        .clickable { onCaptureClick() },
                    contentAlignment = Alignment.Center
                ) {
                    if (isAnalyzing) {
                        AnalyzingContent()
                    } else if (detectedItems.isEmpty()) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Outlined.CameraAlt, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface, modifier = Modifier.size(64.dp))
                            Spacer(Modifier.height(AppSpacing.md))
                            Text(t(S.captureMeal), color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.headlineSmall)
                            Spacer(Modifier.height(AppSpacing.xs))
                            Text(t(S.pointCamera), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                        }
                    } else {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Outlined.Check, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface, modifier = Modifier.size(48.dp))
                            Spacer(Modifier.height(AppSpacing.sm))
                            Text(tf(S.detectedItems, detectedItems.size.toString()), color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.height(AppSpacing.xs))
                            Text(t(S.tapAgain), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                Spacer(Modifier.height(AppSpacing.xl))
            }

            // Detected items
            if (detectedItems.isNotEmpty()) {
                item {
                    AppSectionTitle(t(S.detectedFoodTitle))
                    Spacer(Modifier.height(AppSpacing.md))
                }
                itemsIndexed(detectedItems, key = { i, it -> "$i-${it.name}" }) { _, item ->
                    val logged = item.name in loggedItems
                    AppListRow(
                        title = item.name,
                        subtitle = tf2(S.percentMatch, item.estimatedKcal.toString(), (item.confidence * 100).toInt().toString()),
                        leading = { IconBubble(Icons.Outlined.Restaurant, HeroYellow) },
                        trailing = {
                            if (logged) {
                                Icon(Icons.Outlined.Check, contentDescription = "Logged", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp))
                            } else {
                                StatusPill(t(S.logLabel), Tone.Brand)
                            }
                        },
                        onClick = {
                            if (!logged) {
                                onLogDetectedFood(kidId, item.name, item.estimatedKcal)
                                loggedItems = loggedItems + item.name
                            }
                        },
                    )
                    Spacer(Modifier.height(AppSpacing.md))
                }
            }

            item {
                Spacer(Modifier.height(AppSpacing.lg))
                Text(
                    t(S.foodRecTip),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun AnalyzingContent() {
    val infinite = rememberInfiniteTransition(label = "scan")
    val alpha by infinite.animateFloat(
        initialValue = 0.4f, targetValue = 0.9f,
        animationSpec = infiniteRepeatable(tween(600), RepeatMode.Reverse),
        label = "pulse"
    )
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Outlined.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha), modifier = Modifier.size(56.dp))
        Spacer(Modifier.height(AppSpacing.md))
        Text(t(S.analyzingPhoto), color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(AppSpacing.xxs))
        Text(t(S.identifyingFood), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(AppSpacing.md))
        LinearProgressIndicator(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .height(4.dp)
                .clip(RoundedCornerShape(50)),
            color = MaterialTheme.colorScheme.onSurface,
            trackColor = MaterialTheme.colorScheme.surface,
        )
    }
}
