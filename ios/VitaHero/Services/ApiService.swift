//
//  ApiService.swift
//  VitaHero
//
//  Created for VitaHero (KidHero Health) iOS Platform.
//

import Foundation

public final class ApiService {
    public static let shared = ApiService()
    
    public var baseUrl: String = "https://vitahero.kallam.workers.dev"
    public var sessionToken: String? = nil
    
    public var isConfigured: Bool {
        return !baseUrl.isEmpty
    }
    
    private init() {}
    
    public func request<T: Decodable>(_ path: String, method: String = "GET", body: Data? = nil) async throws -> T {
        guard let url = URL(string: "\(baseUrl)\(path)") else {
            throw URLError(.badURL)
        }
        
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = sessionToken, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body {
            req.httpBody = body
        }
        
        let (data, response) = try await URLSession.shared.data(for: req)
        
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: data)
    }
    
    public func fetchClinicianRoster() async throws -> [ClinicianStudentDto] {
        return [
            ClinicianStudentDto(id: "k_1", studentName: "Aarav Sharma", age: 10, gender: "Male", gradeClass: "5th A", schoolName: "Delhi Public School", rollNumber: "12", guardianName: "Rajesh Sharma", guardianPhone: "+91 98765 43210", status: .pending),
            ClinicianStudentDto(id: "k_2", studentName: "Ananya Reddy", age: 9, gender: "Female", gradeClass: "4th B", schoolName: "Delhi Public School", rollNumber: "04", guardianName: "Sita Reddy", guardianPhone: "+91 98765 43211", status: .pending),
            ClinicianStudentDto(id: "k_3", studentName: "Vihaan Verma", age: 11, gender: "Male", gradeClass: "6th A", schoolName: "Delhi Public School", rollNumber: "28", guardianName: "Sunil Verma", guardianPhone: "+91 98765 43212", status: .completed),
            ClinicianStudentDto(id: "k_4", studentName: "Riya Patel", age: 8, gender: "Female", gradeClass: "3rd C", schoolName: "Delhi Public School", rollNumber: "15", guardianName: "Kiran Patel", guardianPhone: "+91 98765 43213", status: .referred, flags: ["Needs Eye Exam"])
        ]
    }
    
    public func submitScreeningRecord(_ record: CompleteScreeningRecordDto) async throws -> Bool {
        return true
    }
    
    public func clearSession() {
        sessionToken = nil
    }
}
