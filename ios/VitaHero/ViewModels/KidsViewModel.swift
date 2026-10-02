import Foundation
import Combine
import SwiftUI

/// KidsViewModel manages pediatric profiles, growth trajectories, and health badges.
@MainActor
final class KidsViewModel: ObservableObject {
    @Published var kids: [KidProfileDto] = []
    @Published var selectedKid: KidProfileDto? = nil
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil
    
    // Add child modal state
    @Published var newChildName: String = ""
    @Published var newChildAge: String = ""
    @Published var newChildGender: String = "Male"
    @Published var newChildBloodGroup: String = "O+"
    @Published var isSubmittingChild: Bool = false
    
    private let apiService: ApiService
    private var cancellables = Set<AnyCancellable>()
    
    init(apiService: ApiService = .shared) {
        self.apiService = apiService
        loadKids()
    }
    
    func loadKids() {
        isLoading = true
        Task {
            do {
                let list = try await apiService.fetchKidsProfiles()
                self.kids = list
                if self.selectedKid == nil {
                    self.selectedKid = list.first
                }
                self.isLoading = false
            } catch {
                self.errorMessage = error.localizedDescription
                self.isLoading = false
            }
        }
    }
    
    func selectKid(byId id: String) {
        if let found = kids.first(where: { $0.id == id }) {
            self.selectedKid = found
        }
    }
    
    func addChild() async -> Bool {
        guard !newChildName.trimmingCharacters(in: .whitespaces).isEmpty,
              let ageNum = Int(newChildAge), ageNum > 0 else {
            self.errorMessage = "Please enter a valid child name and age."
            return false
        }
        
        isSubmittingChild = true
        let newKid = KidProfileDto(
            id: "kid_\(UUID().uuidString.prefix(6))",
            name: newChildName,
            age: ageNum,
            gender: newChildGender,
            bloodGroup: newChildBloodGroup,
            avatarUrl: nil,
            healthScore: 92,
            heightCm: 110.0,
            weightKg: 18.5,
            bmi: 15.3,
            vaccineStatus: "Up to Date",
            lastCheckupDate: "2026-09-15"
        )
        
        // Mock add
        try? await Task.sleep(nanoseconds: 300_000_000)
        self.kids.append(newKid)
        self.selectedKid = newKid
        self.newChildName = ""
        self.newChildAge = ""
        self.isSubmittingChild = false
        return true
    }
}
