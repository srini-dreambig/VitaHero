package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AddAPhoto
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.AppLocale
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.FieldLabel
import com.rork.vitahero.ui.components.HeroTextField
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.AppTheme
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddKidScreen(
    onBack: () -> Unit,
    onSave: (name: String, age: Int, gender: String, school: String, grade: String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var age by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("Boy") }
    var school by remember { mutableStateOf("") }
    var grade by remember { mutableStateOf("") }

    val canSave = name.isNotBlank() && age.isNotBlank()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(t(S.addChild), style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { pad ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(pad)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
        ) {
            Spacer(Modifier.height(8.dp))
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Box(
                    Modifier
                        .size(96.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(HeroOrange.copy(alpha = 0.18f), HeroBlue.copy(alpha = 0.18f))))
                        .border(2.dp, MaterialTheme.colorScheme.outline, CircleShape)
                        .clickable { },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.AddAPhoto, contentDescription = "Add photo", tint = HeroOrange, modifier = Modifier.size(34.dp))
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                t(S.addPhotoOptional),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
                fontWeight = FontWeight.Medium
            )
            Spacer(Modifier.height(24.dp))

            FieldLabel(t(S.kidName))
            HeroTextField(value = name, onValueChange = { name = it }, placeholder = "e.g. Rahul Sharma")
            Spacer(Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    FieldLabel(t(S.kidAge))
                    HeroTextField(value = age, onValueChange = { age = it.filter(Char::isDigit).take(2) }, placeholder = "Years", keyboardType = KeyboardType.Number)
                }
                Column(Modifier.weight(1.4f)) {
                    FieldLabel(t(S.kidGender))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        GenderChip(t(S.boy), gender == "Boy", Modifier.weight(1f)) { gender = "Boy" }
                        GenderChip(t(S.girl), gender == "Girl", Modifier.weight(1f)) { gender = "Girl" }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))

            FieldLabel(t(S.kidSchool))
            HeroTextField(value = school, onValueChange = { school = it }, placeholder = "School name")
            Spacer(Modifier.height(16.dp))

            FieldLabel(t(S.kidGrade))
            HeroTextField(value = grade, onValueChange = { grade = it }, placeholder = "e.g. Class 4-B")
            Spacer(Modifier.height(16.dp))

            // Height and weight are not asked for. They are measured at a
            // school camp by someone trained to measure them, and a number a
            // parent types at home would be indistinguishable in the record
            // from one a nurse took — which is exactly the confusion a health
            // record must not have.
            Spacer(Modifier.height(20.dp))
            InfoBanner(t(S.addChildNoMeasurements))

            Spacer(Modifier.height(24.dp))
            PrimaryGradientButton(
                text = t(S.saveKid),
                enabled = canSave,
                onClick = {
                    onSave(
                        name.trim(),
                        age.toIntOrNull() ?: 0,
                        gender,
                        school.trim(),
                        grade.trim(),
                    )
                },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun GenderChip(text: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .height(56.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) HeroOrange.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface)
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) HeroOrange else MaterialTheme.colorScheme.outline,
                shape = RoundedCornerShape(14.dp)
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text,
            style = MaterialTheme.typography.titleSmall,
            color = if (selected) HeroOrange else MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun AddKidScreenPreview() {
    androidx.compose.runtime.CompositionLocalProvider(LocalAppLocale provides AppLocale.ENGLISH) {
        AppTheme {
            AddKidScreen(onBack = {}, onSave = { _, _, _, _, _, _, _ -> })
        }
    }
}

@Composable
private fun InfoBanner(text: String) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            .padding(14.dp),
    ) {
        Text(
            text,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
