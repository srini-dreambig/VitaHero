package com.rork.vitahero.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rork.vitahero.R
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.HeroOrange
import kotlinx.coroutines.delay

/**
 * Branded launch screen — mirrors the sign-in UI standards (centered wordmark logo
 * on the brand background). Calls [onTimeout] after a short reveal animation.
 */
@Composable
fun SplashScreen(onTimeout: () -> Unit) {
    val reveal = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        reveal.animateTo(1f, animationSpec = tween(600))
    }

    LaunchedEffect(Unit) {
        delay(1300)
        onTimeout()
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Image(
            painter = painterResource(id = R.drawable.vitahero_logo),
            contentDescription = "VitaHero",
            modifier = Modifier
                .fillMaxWidth(0.66f)
                .heightIn(max = 200.dp)
                .scale(0.92f + reveal.value * 0.08f)
                .alpha(reveal.value)
        )
        Spacer(Modifier.height(8.dp))
        Text(
            t(S.appSubtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.alpha(reveal.value),
        )
        Spacer(Modifier.height(28.dp))
        CircularProgressIndicator(
            modifier = Modifier
                .size(22.dp)
                .alpha(reveal.value),
            strokeWidth = 2.dp,
            color = HeroOrange,
        )
    }
}
