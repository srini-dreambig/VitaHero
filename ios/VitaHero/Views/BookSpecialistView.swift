import SwiftUI

/// Doctor Specialist Lookup & Appointment Booking Screen.
struct BookSpecialistView: View {
    @EnvironmentObject var appViewModel: AppViewModel
    @EnvironmentObject var kidsViewModel: KidsViewModel
    @StateObject private var viewModel = BookingViewModel()
    
    @State private var showingBookingModal: Bool = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppTheme.Layout.spacing20) {
                // Top Header & Search
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    Text("Pediatric Specialists")
                        .font(AppTheme.Typography.font(for: .displayTitle))
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    HeroTextField(
                        label: "Search Doctors or Hospitals",
                        placeholder: "Dr. Evans, Vision Clinic, Dental...",
                        text: $viewModel.searchQuery,
                        iconName: "magnifyingglass"
                    )
                    
                    // Specialty Category Pills
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: AppTheme.Layout.spacing8) {
                            ForEach(viewModel.specialtyOptions, id: \.self) { spec in
                                Button(action: { viewModel.selectedSpecialty = spec }) {
                                    Text(spec)
                                        .font(AppTheme.Typography.font(for: .bodyMedium))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .background(
                                            viewModel.selectedSpecialty == spec ? AppTheme.Colors.heroBlue : Color.white
                                        )
                                        .foregroundColor(viewModel.selectedSpecialty == spec ? .white : AppTheme.Colors.textPrimary)
                                        .cornerRadius(18)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 18)
                                                .stroke(AppTheme.Colors.glassBorder, lineWidth: 1)
                                        )
                                }
                            }
                        }
                    }
                }
                
                // Specialists Grid
                if viewModel.isLoading {
                    ProgressView("Loading top pediatric specialists...")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                } else {
                    ForEach(viewModel.filteredSpecialists) { doctor in
                        HeroCard(backgroundColor: Color.white) {
                            HStack(alignment: .top, spacing: AppTheme.Layout.spacing16) {
                                Circle()
                                    .fill(AppTheme.Colors.heroBlue.opacity(0.15))
                                    .frame(width: 54, height: 54)
                                    .overlay(
                                        Image(systemName: "stethoscope")
                                            .font(.system(size: 24))
                                            .foregroundColor(AppTheme.Colors.heroBlue)
                                    )
                                
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(doctor.name)
                                            .font(AppTheme.Typography.font(for: .cardTitleMedium))
                                            .foregroundColor(AppTheme.Colors.textPrimary)
                                        Spacer()
                                        HStack(spacing: 2) {
                                            Image(systemName: "star.fill")
                                                .foregroundColor(AppTheme.Colors.amber)
                                                .font(.system(size: 12))
                                            Text(String(format: "%.1f", doctor.rating))
                                                .font(AppTheme.Typography.font(for: .captionMedium))
                                        }
                                    }
                                    
                                    Text(doctor.specialty)
                                        .font(AppTheme.Typography.font(for: .captionMedium))
                                        .foregroundColor(AppTheme.Colors.heroBlue)
                                    
                                    Text("\(doctor.hospitalName) • \(doctor.experienceYears) yrs exp")
                                        .font(AppTheme.Typography.font(for: .captionRegular))
                                        .foregroundColor(AppTheme.Colors.textSecondary)
                                    
                                    HStack {
                                        StatusPill(text: doctor.nextAvailableSlot, style: .success)
                                        Spacer()
                                        Button(action: {
                                            viewModel.selectedDoctor = doctor
                                            showingBookingModal = true
                                        }) {
                                            Text("Book Visit")
                                                .font(AppTheme.Typography.font(for: .buttonLabel))
                                                .foregroundColor(.white)
                                                .padding(.horizontal, 16)
                                                .padding(.vertical, 8)
                                                .background(AppTheme.Colors.heroOrange)
                                                .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
                                        }
                                    }
                                    .padding(.top, 6)
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, AppTheme.Layout.spacing20)
            .padding(.vertical, AppTheme.Layout.spacing16)
        }
        .background(AppTheme.Colors.surfaceBackground.ignoresSafeArea())
        .sheet(isPresented: $showingBookingModal) {
            bookingModalView
        }
    }
    
    // Booking Sheet View
    private var bookingModalView: some View {
        NavigationView {
            Form {
                if let doc = viewModel.selectedDoctor {
                    Section(header: Text("Doctor Info")) {
                        Text(doc.name).font(.headline)
                        Text(doc.specialty).foregroundColor(.secondary)
                        Text(doc.hospitalName)
                    }
                    
                    Section(header: Text("Appointment Type")) {
                        Picker("Type", selection: $viewModel.appointmentType) {
                            ForEach(BookingViewModel.AppointmentType.allCases) { type in
                                Text(type.rawValue).tag(type)
                            }
                        }
                        .pickerStyle(SegmentedPickerStyle())
                    }
                    
                    Section(header: Text("Select Date & Time")) {
                        DatePicker("Date", selection: $viewModel.selectedDate, displayedComponents: .date)
                        Picker("Time Slot", selection: $viewModel.selectedTimeSlot) {
                            ForEach(doc.availableSlots, id: \.self) { slot in
                                Text(slot).tag(slot)
                            }
                        }
                    }
                    
                    Section {
                        Button(action: {
                            Task {
                                let kidId = kidsViewModel.selectedKid?.id ?? "kid_1"
                                let kidName = kidsViewModel.selectedKid?.name ?? "Child"
                                let ok = await viewModel.bookAppointment(kidId: kidId, kidName: kidName)
                                if ok {
                                    showingBookingModal = false
                                    appViewModel.showToast(title: "Appointment Booked!", message: "Confirmed with \(doc.name).", style: .success)
                                }
                            }
                        }) {
                            if viewModel.isBooking {
                                ProgressView()
                            } else {
                                Text("Confirm Reservation")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .listRowBackground(AppTheme.Colors.heroOrange)
                    }
                }
            }
            .navigationTitle("Schedule Visit")
            .navigationBarItems(trailing: Button("Cancel") { showingBookingModal = false })
        }
    }
}
