import Foundation
import Combine
import SwiftUI

/// BookingViewModel manages doctor specialist lookup, slot reservation, and appointment history.
@MainActor
final class BookingViewModel: ObservableObject {
    @Published var specialists: [SpecialistDoctorDto] = []
    @Published var selectedSpecialty: String = "All Specialties"
    @Published var searchQuery: String = ""
    @Published var selectedDoctor: SpecialistDoctorDto? = nil
    @Published var selectedDate: Date = Date().addingTimeInterval(86400)
    @Published var selectedTimeSlot: String = "10:30 AM"
    @Published var appointmentType: AppointmentType = .telehealth
    @Published var isBooking: Bool = false
    @Published var bookingSuccess: Bool = false
    @Published var appointmentHistory: [AppointmentDto] = []
    @Published var isLoading: Bool = false
    
    private let apiService: ApiService
    private var cancellables = Set<AnyCancellable>()
    
    init(apiService: ApiService = .shared) {
        self.apiService = apiService
        loadSpecialists()
    }
    
    enum AppointmentType: String, CaseIterable, Identifiable {
        case telehealth = "Video Telehealth"
        case inPerson = "In-Clinic Visit"
        
        var id: String { rawValue }
    }
    
    let specialtyOptions = [
        "All Specialties",
        "Pediatrician",
        "Pediatric Ophthalmologist",
        "Pediatric Dentist",
        "Pediatric ENT",
        "Dermatologist",
        "Nutritionist"
    ]
    
    var filteredSpecialists: [SpecialistDoctorDto] {
        specialists.filter { doc in
            let matchesQuery = searchQuery.isEmpty ||
                doc.name.localizedCaseInsensitiveContains(searchQuery) ||
                doc.specialty.localizedCaseInsensitiveContains(searchQuery) ||
                doc.hospitalName.localizedCaseInsensitiveContains(searchQuery)
            
            let matchesSpecialty = selectedSpecialty == "All Specialties" || doc.specialty.localizedCaseInsensitiveContains(selectedSpecialty)
            return matchesQuery && matchesSpecialty
        }
    }
    
    func loadSpecialists() {
        isLoading = true
        Task {
            do {
                let list = try await apiService.fetchSpecialists()
                self.specialists = list
                self.isLoading = false
            } catch {
                self.isLoading = false
            }
        }
    }
    
    func bookAppointment(kidId: String, kidName: String) async -> Bool {
        guard let doc = selectedDoctor else { return false }
        isBooking = true
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateStr = formatter.string(from: selectedDate)
        
        let newAppt = AppointmentDto(
            id: "appt_\(UUID().uuidString.prefix(6))",
            doctorId: doc.id,
            doctorName: doc.name,
            doctorSpecialty: doc.specialty,
            doctorAvatarUrl: doc.avatarUrl,
            kidId: kidId,
            kidName: kidName,
            date: dateStr,
            timeSlot: selectedTimeSlot,
            appointmentType: appointmentType.rawValue,
            status: "Confirmed",
            meetingLink: appointmentType == .telehealth ? "https://telehealth.vitahero.health/room/\(UUID().uuidString.prefix(8))" : nil
        )
        
        try? await Task.sleep(nanoseconds: 500_000_000)
        self.appointmentHistory.insert(newAppt, at: 0)
        self.isBooking = false
        self.bookingSuccess = true
        return true
    }
}
