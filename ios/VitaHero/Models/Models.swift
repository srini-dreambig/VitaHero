//
//  Models.swift
//  VitaHero
//
//  Created for VitaHero (KidHero Health) iOS Platform.
//

import Foundation
import SwiftUI

public enum HealthFlag: String, Codable, CaseIterable {
    case good = "GOOD"
    case watch = "WATCH"
    case alert = "ALERT"
    
    public var label: String {
        switch self {
        case .good: return "Normal"
        case .watch: return "Needs watching"
        case .alert: return "Needs attention"
        }
    }
    
    public var color: Color {
        switch self {
        case .good: return AppColors.heroGreen
        case .watch: return AppColors.heroOrange
        case .alert: return AppColors.heroRed
        }
    }
}

public struct GrowthPoint: Identifiable, Codable {
    public let id: String
    public let label: String
    public let height: Float
    public let weight: Float
    
    public init(id: String = UUID().uuidString, label: String, height: Float, weight: Float) {
        self.id = id
        self.label = label
        self.height = height
        self.weight = weight
    }
}

public struct Kid: Identifiable, Codable {
    public let id: String
    public var name: String
    public var age: Int
    public var gender: String
    public var school: String
    public var grade: String
    public var heightCm: Float
    public var weightKg: Float
    public var avatarColor: Int64
    public var overallScore: Int
    public var growth: [GrowthPoint]
    public var dental: HealthFlag
    public var eyesight: HealthFlag
    public var nutrition: HealthFlag
    public var lastCheckup: String
    
    public init(
        id: String,
        name: String,
        age: Int,
        gender: String,
        school: String,
        grade: String,
        heightCm: Float,
        weightKg: Float,
        avatarColor: Int64 = 0xFF10B981,
        overallScore: Int = 85,
        growth: [GrowthPoint] = [],
        dental: HealthFlag = .good,
        eyesight: HealthFlag = .good,
        nutrition: HealthFlag = .good,
        lastCheckup: String = "2026-09-01"
    ) {
        self.id = id
        self.name = name
        self.age = age
        self.gender = gender
        self.school = school
        self.grade = grade
        self.heightCm = heightCm
        self.weightKg = weightKg
        self.avatarColor = avatarColor
        self.overallScore = overallScore
        self.growth = growth
        self.dental = dental
        self.eyesight = eyesight
        self.nutrition = nutrition
        self.lastCheckup = lastCheckup
    }
}

public enum CampStatus: String, Codable {
    case upcoming = "UPCOMING"
    case inProgress = "IN_PROGRESS"
    case completed = "COMPLETED"
}

public struct Camp: Identifiable, Codable {
    public let id: String
    public var title: String
    public var school: String
    public var date: String
    public var time: String
    public var status: CampStatus
    public var checks: [String]
    public var resultSummary: String
    
    public init(
        id: String,
        title: String,
        school: String,
        date: String,
        time: String,
        status: CampStatus,
        checks: [String],
        resultSummary: String
    ) {
        self.id = id
        self.title = title
        self.school = school
        self.date = date
        self.time = time
        self.status = status
        self.checks = checks
        self.resultSummary = resultSummary
    }
}
