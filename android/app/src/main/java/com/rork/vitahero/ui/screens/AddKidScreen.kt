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
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroGreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddKidScreen(
    onBack: () -> Unit,
    onSave: (name: String, age: Int, gender: String, school: String, grade: String, height: Float, weight: Float) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var age by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("Boy") }
    var school by remember { mutableStateOf("") }
    var grade by remember { mutableStateOf("") }
    var height by remember { mutableStateOf("") }
    var weight by remember { mutableStateOf("") }

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
                        .background(Brush.linearGradient(listOf(HeroGreen.copy(alpha = 0.18f), HeroBlue.copy(alpha = 0.18f))))
                        .border(2.dp, MaterialTheme.colorScheme.outline, CircleShape)
                        .clickable { },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.AddAPhoto, contentDescription = "Add photo", tint = HeroGreen, modifier = Modifier.size(34.dp))
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

            Label(t(S.kidName))
            HeroTextField(value = name, onValueChange = { name = it }, placeholder = "e.g. Rahul Sharma")
            Spacer(Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Label(t(S.kidAge))
                    HeroTextField(value = age, onValueChange = { age = it.filter(Char::isDigit).take(2) }, placeholder = "Years", keyboardType = KeyboardType.Number)
                }
                Column(Modifier.weight(1.4f)) {
                    Label(t(S.kidGender))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        GenderChip(t(S.boy), gender == "Boy", Modifier.weight(1f)) { gender = "Boy" }
                        GenderChip(t(S.girl), gender == "Girl", Modifier.weight(1f)) { gender = "Girl" }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))

            Label(t(S.kidSchool))
            HeroTextField(value = school, onValueChange = { school = it }, placeholder = "School name")
            Spacer(Modifier.height(16.dp))

            Label(t(S.kidGrade))
            HeroTextField(value = grade, onValueChange = { grade = it }, placeholder = "e.g. Class 4-B")
            Spacer(Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Label(t(S.kidHeight))
                    HeroTextField(value = height, onValueChange = { height = it.filter { c -> c.isDigit() || c == '.' } }, placeholder = "e.g. 132", keyboardType = KeyboardType.Number)
                }
                Column(Modifier.weight(1f)) {
                    Label(t(S.kidWeight))
                    HeroTextField(value = weight, onValueChange = { weight = it.filter { c -> c.isDigit() || c == '.' } }, placeholder = "e.g. 29", keyboardType = KeyboardType.Number)
                }
            }

            Spacer(Modifier.height(32.dp))
            PrimaryGradientButton(
                text = t(S.saveKid),
                enabled = canSave,
                onClick = {
                    onSave(
                        name.trim(),
                        age.toIntOrNull() ?: 8,
                        gender,
                        school.ifBlank { "—" },
                        grade.ifBlank { "—" },
                        height.toFloatOrNull() ?: 120f,
                        weight.toFloatOrNull() ?: 24f
                    )
                },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun Label(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(bottom = 8.dp)
    )
}

@Composable
private fun GenderChip(text: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .height(56.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) HeroGreen.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface)
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) HeroGreen else MaterialTheme.colorScheme.outline,
                shape = RoundedCornerShape(14.dp)
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text,
            style = MaterialTheme.typography.titleSmall,
            color = if (selected) HeroGreen else MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
    }
}
