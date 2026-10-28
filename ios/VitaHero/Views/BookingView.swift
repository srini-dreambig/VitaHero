import SwiftUI
import CoreLocation

/// Hospitals near the family, their doctors and open slots, and the parent's
/// own bookings.
struct BookingView: View {
    @EnvironmentObject private var store: AppStore
    @StateObject private var location = LocationProvider()
    @State private var city = ""
    @State private var specialty = ""
    @State private var directory: BookingDirectory?
    @State private var error: String?
    @State private var searching = false

    var body: some View {
        List {
            if let error { Banner(text: error).listRowInsets(EdgeInsets()) }

            if !store.appointments.isEmpty {
                Section(L("your_appts")) {
                    ForEach(store.appointments) { appt in
                        AppointmentRow(appointment: appt) { cancel(appt) }
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                    }
                }
            }

            Section {
                HStack {
                    Image(systemName: "building.2").foregroundColor(.secondary)
                    TextField(L("your_area"), text: $city)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.search)
                        .onSubmit { Task { await search() } }
                }
                if let specialties = directory?.specialties, !specialties.isEmpty {
                    Picker(L("view_by_specialty"), selection: $specialty) {
                        Text(L("all_specialties")).tag("")
                        ForEach(specialties, id: \.self) { Text($0).tag($0) }
                    }
                }
                Button {
                    location.request()
                } label: {
                    HStack {
                        Label(L("use_my_location"), systemImage: "location.fill")
                        if location.locating { Spacer(); ProgressView() }
                    }
                }
                if location.denied {
                    Text(L("location_denied")).font(.caption).foregroundColor(.secondary)
                } else if location.coordinate != nil {
                    Text(L("location_sorted")).font(.caption).foregroundColor(.secondary)
                }
            }

            Section(L("hospitals_near_you")) {
                if searching {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else if let hospitals = directory?.hospitals {
                    if hospitals.isEmpty { Text(L("no_hospitals_found")).foregroundColor(.secondary) }
                    ForEach(hospitals) { hospital in
                        NavigationLink { HospitalView(hospital: hospital) } label: { HospitalRow(hospital: hospital) }
                    }
                }
            }
        }
        .navigationTitle(L("book_visit"))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if city.isEmpty { city = store.homeCity }
            if directory == nil { await search() }
        }
        .onChange(of: specialty) { _ in Task { await search() } }
        .onChange(of: location.coordinate?.latitude) { _ in Task { await search() } }
        .refreshable { await search() }
    }

    private func search() async {
        searching = true
        defer { searching = false }
        do {
            let coordinate = location.coordinate
            directory = try await store.directory(city: city.trimmingCharacters(in: .whitespaces),
                                                  specialty: specialty,
                                                  lat: coordinate?.latitude, lng: coordinate?.longitude)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func cancel(_ appointment: Appointment) {
        Task {
            do { try await store.cancel(appointment) } catch { store.toast = error.localizedDescription }
        }
    }
}

struct HospitalRow: View {
    let hospital: Hospital

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(hospital.name).font(.headline)
                Spacer()
                if hospital.isCampPartner || hospital.userCampLinked {
                    Pill(text: L("camp_partner_hospital"), color: Brand.green)
                }
            }
            Text([hospital.district, hospital.city].filter { !$0.isEmpty }.joined(separator: ", "))
                .font(.subheadline).foregroundColor(.secondary)
            HStack(spacing: 12) {
                if let km = hospital.distanceKm {
                    Label(L("km_away", String(format: "%.1f", km)), systemImage: "location")
                }
                if hospital.rating > 0 {
                    Label(String(format: "%.1f", hospital.rating), systemImage: "star.fill")
                }
            }
            .font(.caption).foregroundColor(.secondary)
        }
        .padding(.vertical, 2)
    }
}

struct HospitalView: View {
    let hospital: Hospital

    var body: some View {
        List {
            Section {
                HospitalRow(hospital: hospital)
                if !hospital.address.isEmpty { Label(hospital.address, systemImage: "mappin.and.ellipse").font(.subheadline) }
                if !hospital.phone.isEmpty, let url = URL(string: "tel:\(hospital.phone.filter { $0.isNumber || $0 == "+" })") {
                    Link(destination: url) { Label(hospital.phone, systemImage: "phone.fill") }
                }
            }
            Section(L("select_doctor")) {
                if hospital.doctors.isEmpty { Text(L("no_doctors_found")).foregroundColor(.secondary) }
                ForEach(hospital.doctors) { doctor in
                    NavigationLink { SlotPickerView(doctor: doctor) } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(doctor.name).font(.headline)
                            Text(doctor.specialty).font(.subheadline).foregroundColor(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(hospital.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// A doctor's open slots, the child, and the booking.
struct SlotPickerView: View {
    let doctor: Doctor
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var auth: AuthManager
    @Environment(\.dismiss) private var dismiss
    @State private var slots: [Slot]?
    @State private var slot: Slot?
    @State private var kidId: String?
    @State private var busy = false
    @State private var error: String?

    private var days: [String] {
        var seen = Set<String>()
        return (slots ?? []).map(\.date).filter { seen.insert($0).inserted }
    }

    var body: some View {
        List {
            if let error { Banner(text: error, color: Brand.red).listRowInsets(EdgeInsets()) }
            Section {
                VStack(alignment: .leading, spacing: 2) {
                    Text(doctor.name).font(.headline)
                    Text([doctor.specialty, doctor.hospital].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.subheadline).foregroundColor(.secondary)
                }
            }
            Section(L("select_kid")) {
                Picker(L("select_kid"), selection: $kidId) {
                    ForEach(store.allKids) { Text($0.name).tag(Optional($0.id)) }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }
            if let slots {
                if slots.isEmpty { Section { Text(L("no_slots_available")).foregroundColor(.secondary) } }
                ForEach(days, id: \.self) { day in
                    Section(day) {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: 8)], spacing: 8) {
                            ForEach(slots.filter { $0.date == day }) { item in
                                let selected = item == slot
                                Button { slot = item } label: {
                                    Text(item.label.isEmpty ? item.time : item.label)
                                        .font(.subheadline.weight(.semibold))
                                        .frame(maxWidth: .infinity, minHeight: 36)
                                        .foregroundColor(selected ? .white : .primary)
                                        .background(selected ? Brand.orange : Color(.tertiarySystemFill))
                                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            } else {
                HStack { Spacer(); ProgressView(); Spacer() }
            }
            Section {
                PrimaryButton(title: busy ? L("booking_in_progress") : L("confirm_booking"), busy: busy,
                              enabled: slot != nil && kidId != nil) { book() }
                    .listRowInsets(EdgeInsets())
            }
            .listRowBackground(Color.clear)
        }
        .navigationTitle(L("select_time"))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if kidId == nil { kidId = store.selectedKid?.id }
            await loadSlots()
        }
        .refreshable { await loadSlots() }
    }

    private func loadSlots() async {
        do {
            slots = try await store.slots(doctorId: doctor.id)
            error = nil
        } catch {
            slots = slots ?? []
            self.error = error.localizedDescription
        }
    }

    private func book() {
        guard let slot, let kid = store.allKids.first(where: { $0.id == kidId }) else { return }
        busy = true; error = nil
        Task {
            do {
                try await store.book(doctor: doctor, slot: slot, kid: kid, profile: auth.profile)
                store.toast = L("appt_confirmed")
                dismiss()
            } catch APIError.unreachable {
                self.error = L("booking_could_not_reach")
            } catch {
                // The server's own words, e.g. that someone took the slot first.
                self.error = error.localizedDescription
                self.slot = nil
                await loadSlots()
            }
            busy = false
        }
    }
}
