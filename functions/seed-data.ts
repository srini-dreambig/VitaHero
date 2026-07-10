// Seed data for VitaHero — schools, hospitals, and doctors.
// Seeded into Firestore on first Worker run.

interface SeedSchool {
  id: string;
  name: string;
  city: string;
  district: string;
  partner_code: string;
  contact_email: string;
  description: string;
  active: boolean;
}

interface SeedHospital {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  rating: number;
  is_camp_partner: boolean;
  active: boolean;
}

interface SeedDoctor {
  id: string;
  name: string;
  specialty: string;
  hospital: string;
  hospital_id: string;
  city: string;
  rating: number;
  active: boolean;
}

export const SEED_SCHOOLS: SeedSchool[] = [
  { id: "sch_oak", name: "Oakridge International School", city: "Hyderabad", district: "Gachibowli", partner_code: "OAK2026", contact_email: "health@oakridge.in", description: "Partner since 2024 · Full annual screening programme", active: true },
  { id: "sch_dps", name: "Delhi Public School Hyderabad", city: "Hyderabad", district: "Khajaguda", partner_code: "DPS2026", contact_email: "nurse@dpshyd.com", description: "Vision, dental & nutrition camps every term", active: true },
  { id: "sch_jgs", name: "Johnson Grammar School", city: "Hyderabad", district: "Habsiguda", partner_code: "JGS2026", contact_email: "wellness@jgs.edu.in", description: "IAP-aligned growth monitoring", active: true },
  { id: "sch_chirec", name: "CHIREC International School", city: "Hyderabad", district: "Kondapur", partner_code: "CHI2026", contact_email: "health@chirec.in", description: "WHO growth charts integrated with camp results", active: true },
];

export const SEED_HOSPITALS: SeedHospital[] = [
  { id: "hosp_rainbow", name: "Rainbow Children's Hospital", city: "Hyderabad", district: "Banjara Hills", address: "Road No 2, Banjara Hills, Hyderabad", lat: 17.4156, lng: 78.4347, phone: "+914066000000", rating: 4.8, is_camp_partner: true, active: true },
  { id: "hosp_kims", name: "KIMS Hospitals", city: "Hyderabad", district: "Secunderabad", address: "1-8-31/1, Minister Road, Secunderabad", lat: 17.4434, lng: 78.4974, phone: "+914044000000", rating: 4.6, is_camp_partner: true, active: true },
  { id: "hosp_lvp", name: "LV Prasad Eye Institute", city: "Hyderabad", district: "Banjara Hills", address: "L V Prasad Marg, Banjara Hills, Hyderabad", lat: 17.4174, lng: 78.4362, phone: "+914030000000", rating: 4.7, is_camp_partner: true, active: true },
  { id: "hosp_apollo", name: "Apollo Cradle", city: "Hyderabad", district: "Jubilee Hills", address: "Road No 12, Jubilee Hills, Hyderabad", lat: 17.4329, lng: 78.4074, phone: "+914023000000", rating: 4.5, is_camp_partner: false, active: true },
  { id: "hosp_continental", name: "Continental Hospitals", city: "Hyderabad", district: "Gachibowli", address: "IT Industry Park, Gachibowli, Hyderabad", lat: 17.4456, lng: 78.3494, phone: "+914067000000", rating: 4.4, is_camp_partner: true, active: true },
];

export const SEED_DOCTORS: SeedDoctor[] = [
  { id: "d1", name: "Dr. Ananya Rao", specialty: "Paediatrics", hospital: "Rainbow Children's Hospital", hospital_id: "hosp_rainbow", city: "Hyderabad", rating: 4.9, active: true },
  { id: "d2", name: "Dr. Vikram Reddy", specialty: "Dental", hospital: "Apollo Cradle", hospital_id: "hosp_apollo", city: "Hyderabad", rating: 4.7, active: true },
  { id: "d3", name: "Dr. Meera Iyer", specialty: "Ophthalmology", hospital: "LV Prasad Eye Institute", hospital_id: "hosp_lvp", city: "Hyderabad", rating: 4.8, active: true },
  { id: "d4", name: "Dr. Karthik Nair", specialty: "Nutrition", hospital: "KIMS Hospitals", hospital_id: "hosp_kims", city: "Hyderabad", rating: 4.6, active: true },
  { id: "d5", name: "Dr. Priya Sharma", specialty: "General Paediatrics", hospital: "Continental Hospitals", hospital_id: "hosp_continental", city: "Hyderabad", rating: 4.5, active: true },
  { id: "d6", name: "Dr. Arjun Gupta", specialty: "Paediatrics", hospital: "KIMS Hospitals", hospital_id: "hosp_kims", city: "Hyderabad", rating: 4.6, active: true },
  { id: "d7", name: "Dr. Sneha Patel", specialty: "Dental", hospital: "Rainbow Children's Hospital", hospital_id: "hosp_rainbow", city: "Hyderabad", rating: 4.7, active: true },
];
