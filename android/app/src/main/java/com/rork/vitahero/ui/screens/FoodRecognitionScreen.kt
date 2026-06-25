package com.rork.vitahero.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateContentSize
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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.rork.vitahero.data.DetectedFood
import com.rork.vitahero.data.FoodRecognitionService
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf
import com.rork.vitahero.ui.components.tf2
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange
import com.rork.vitahero.ui.theme.HeroPurple
import com.rork.vitahero.ui.theme.HeroYellow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoodRecognitionScreen(
    kidName: String,
    kidId: String,
    onBack: () -> Unit,
    onLogDetectedFood: (String, String, Int) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
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
                    FoodRecognitionService.analyseBitmap(bitmap)
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

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Food Recognition", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { pad ->
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(pad),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp)
        ) {
            item {
                Text(
                    tf(S.takePhotoOf, kidName),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(20.dp))
            }

            // Capture button
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(
                            Brush.linearGradient(
                                if (isAnalyzing) listOf(HeroPurple, HeroBlue)
                                else listOf(HeroOrange, HeroBlue)
                            )
                        )
                        .clickable { onCaptureClick() },
                    contentAlignment = Alignment.Center
                ) {
                    if (isAnalyzing) {
                        AnalyzingContent()
                    } else if (detectedItems.isEmpty()) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Outlined.CameraAlt, contentDescription = null, tint = Color.White, modifier = Modifier.size(64.dp))
                            Spacer(Modifier.height(14.dp))
                            Text(t(S.captureMeal), color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(4.dp))
                            Text(t(S.pointCamera), color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.bodySmall)
                        }
                    } else {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Outlined.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(48.dp))
                            Spacer(Modifier.height(10.dp))
                            Text(tf(S.detectedItems, detectedItems.size.toString()), color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(4.dp))
                            Text(t(S.tapAgain), color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                Spacer(Modifier.height(20.dp))
            }

            // Detected items
            if (detectedItems.isNotEmpty()) {
                item {
                    Text(t(S.detectedFoodTitle), style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.height(12.dp))
                }
                items(detectedItems) { item ->
                    val logged = item.name in loggedItems
                    HeroCard(
                        Modifier
                            .fillMaxWidth()
                            .clickable {
                                if (!logged) {
                                    onLogDetectedFood(kidId, item.name, item.estimatedKcal)
                                    loggedItems = loggedItems + item.name
                                }
                            },
                        background = if (logged) HeroOrange.copy(alpha = 0.07f) else MaterialTheme.colorScheme.surface
                    ) {
                        Row(
                            Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            IconBubble(Icons.Outlined.Restaurant, HeroYellow)
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text(item.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                                Text(
                                    tf2(S.percentMatch, item.estimatedKcal.toString(), (item.confidence * 100).toInt().toString()),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            if (logged) {
                                Icon(Icons.Outlined.Check, contentDescription = "Logged", tint = HeroOrange, modifier = Modifier.size(24.dp))
                            } else {
                                Box(
                                    Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(MaterialTheme.colorScheme.primary)
                                        .padding(horizontal = 14.dp, vertical = 8.dp)
                                ) {
                                    Text("Log", color = Color.White, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                }
            }

            item {
                Spacer(Modifier.height(16.dp))
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
        Icon(Icons.Outlined.Search, contentDescription = null, tint = Color.White.copy(alpha = alpha), modifier = Modifier.size(56.dp))
        Spacer(Modifier.height(14.dp))
        Text(t(S.analyzingPhoto), color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(2.dp))
        Text(t(S.identifyingFood), color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(14.dp))
        LinearProgressIndicator(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp)),
            color = Color.White,
            trackColor = Color.White.copy(alpha = 0.2f),
        )
    }
}
