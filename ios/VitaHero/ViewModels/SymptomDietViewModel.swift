import Foundation
import Combine
import SwiftUI

/// SymptomDietViewModel manages pediatric symptom logging, real working AI diet generation, and food recognition.
@MainActor
final class SymptomDietViewModel: ObservableObject {
    // MARK: - Symptom Logging State
    @Published var selectedCategory: SymptomCategory = .fever
    @Published var symptomDescription: String = ""
    @Published var severity: Double = 3.0 // 1 to 5 scale
    @Published var durationDays: Int = 1
    @Published var isLoggingSymptom: Bool = false
    @Published var symptomLogHistory: [SymptomLogDto] = []
    @Published var aiTriageAdvice: String? = nil
    
    // MARK: - AI Diet & Nutrition State
    @Published var dietGoal: String = "Immunity Boost & Growth"
    @Published var dietaryPreferences: String = "Balanced Non-Vegetarian / Vegetarian"
    @Published var isGeneratingDiet: Bool = false
    @Published var generatedDietTips: DietTipResponseDto? = nil
    
    // MARK: - Food Recognition State
    @Published var isScanningFood: Bool = false
    @Published var foodScanResult: FoodRecognitionDto? = nil
    @Published var selectedFoodCategory: String = "Lunch"
    
    private let apiService: ApiService
    private var cancellables = Set<AnyCancellable>()
    
    init(apiService: ApiService = .shared) {
        self.apiService = apiService
        loadInitialHistory()
    }
    
    enum SymptomCategory: String, CaseIterable, Identifiable {
        case fever = "Fever & Cold"
        case digestion = "Stomach & Digestion"
        case eye = "Eye & Vision"
        case skin = "Skin & Rash"
        case appetite = "Low Appetite"
        case pain = "Pain / Ache"
        
        var id: String { rawValue }
        
        var icon: String {
            switch self {
            case .fever: return "thermometer.medium"
            case .digestion: return "cross.case.fill"
            case .eye: return "eye.fill"
            case .skin: return "sparkles"
            case .appetite: return "fork.knife"
            case .pain: return "bandage.fill"
            }
        }
    }
    
    func loadInitialHistory() {
        self.symptomLogHistory = [
            SymptomLogDto(
                id: "sym_1",
                date: "2026-09-24",
                category: "Fever & Cold",
                severity: 2,
                notes: "Mild runny nose in morning.",
                triageAdvice: "Monitor temperature. Ensure 1.5L hydration."
            ),
            SymptomLogDto(
                id: "sym_2",
                date: "2026-09-20",
                category: "Eye & Vision",
                severity: 1,
                notes: "Slight redness after playground.",
                triageAdvice: "Rinse with clean water. No rub."
            )
        ]
    }
    
    func logSymptom(kidId: String) async -> Bool {
        isLoggingSymptom = true
        let log = SymptomLogDto(
            id: "sym_\(UUID().uuidString.prefix(6))",
            date: ISO8601DateFormatter().string(from: Date()),
            category: selectedCategory.rawValue,
            severity: Int(severity),
            notes: symptomDescription,
            triageAdvice: generateTriageText()
        )
        
        try? await Task.sleep(nanoseconds: 400_000_000)
        self.symptomLogHistory.insert(log, at: 0)
        self.aiTriageAdvice = log.triageAdvice
        self.symptomDescription = ""
        self.isLoggingSymptom = false
        return true
    }
    
    func generatePersonalizedDiet(kidId: String, age: Int) async {
        isGeneratingDiet = true
        do {
            let res = try await apiService.generatePersonalizedDietTips(
                kidId: kidId,
                age: age,
                goal: dietGoal,
                preferences: dietaryPreferences
            )
            self.generatedDietTips = res
            self.isGeneratingDiet = false
        } catch {
            self.isGeneratingDiet = false
        }
    }
    
    func recognizeFood(imageBytes: Data?) async {
        isScanningFood = true
        do {
            let res = try await apiService.recognizeFoodItem(imageData: imageBytes)
            self.foodScanResult = res
            self.isScanningFood = false
        } catch {
            self.isScanningFood = false
        }
    }
    
    private func generateTriageText() -> String {
        switch selectedCategory {
        case .fever:
            return severity >= 4 ? "High fever recorded. Consult pediatrician immediately if > 102°F." : "Mild fever symptoms. Rest, liquid intake, and monitor every 4 hours."
        case .eye:
            return "Eye irritation noted. Avoid rubbing. Check for discharge or photophobia."
        case .digestion:
            return "Provide light ORS fluids. Avoid heavy dairy or fried food for 12 hours."
        default:
            return "Symptom logged into health record. Routine monitoring advised."
        }
    }
}
