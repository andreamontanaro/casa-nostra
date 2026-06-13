import { createClient } from '@/lib/supabase/server'
import { CAR_PHOTOS_BUCKET } from '@/lib/car-photos'
import {
  computeConsumption,
  computeOdometerConsumptionStats,
  currentKm,
  type Car,
  type FuelEntry,
  type OdometerReading,
} from '@/lib/cars'
import type { Tables } from '@/types/database'

export type FuelEntryWithCar = Tables<'fuel_entries'> & {
  car: { model: string } | null
}

/** Crea un signed URL (1 ora) per una foto del bucket privato, o null. */
async function signPhoto(path: string | null): Promise<string | null> {
  if (!path) return null
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from(CAR_PHOTOS_BUCKET)
    .createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? null
}

export type GarageCar = {
  car: Car
  photoUrl: string | null
  currentKm: number
  avgLPer100km: number | null
}

/** Elenco auto dell'utente con km attuale, consumo medio e foto firmata. */
export async function getGarage(): Promise<GarageCar[]> {
  const supabase = await createClient()

  const [carsRes, fuelRes, odoRes] = await Promise.all([
    supabase.from('cars').select('*').order('created_at', { ascending: true }),
    supabase
      .from('fuel_entries')
      .select('car_id, entry_date, liters, total_cost, odometer_km, full_tank'),
    supabase.from('odometer_readings').select('car_id, reading_date, km, avg_consumption, consumption_unit'),
  ])

  if (carsRes.error) throw carsRes.error
  const cars = carsRes.data ?? []
  const fuel = fuelRes.data ?? []
  const odo = odoRes.data ?? []

  const signedUrls = await Promise.all(cars.map((c) => signPhoto(c.photo_path)))

  return cars.map((car, i) => {
    const carFuel = fuel.filter((f) => f.car_id === car.id)
    const carOdo = odo.filter((o) => o.car_id === car.id)
    const consumption = computeConsumption(carFuel as FuelEntry[])
    const odoConsumption = computeOdometerConsumptionStats(carOdo as OdometerReading[])
    return {
      car,
      photoUrl: signedUrls[i],
      currentKm: currentKm(car, carFuel, carOdo),
      avgLPer100km: consumption.avgLPer100km ?? odoConsumption.avgLPer100km,
    }
  })
}

export type CarDetail = {
  car: Car
  photoUrl: string | null
  fuelEntries: FuelEntry[]
  odometerReadings: OdometerReading[]
  currentKm: number
}

/** Dettaglio di una singola auto con rifornimenti, letture e km attuale. */
export async function getCarDetail(carId: string): Promise<CarDetail | null> {
  const supabase = await createClient()

  const [carRes, fuelRes, odoRes] = await Promise.all([
    supabase.from('cars').select('*').eq('id', carId).maybeSingle(),
    supabase
      .from('fuel_entries')
      .select('*')
      .eq('car_id', carId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('odometer_readings')
      .select('*')
      .eq('car_id', carId)
      .order('reading_date', { ascending: false }),
  ])

  if (carRes.error) throw carRes.error
  if (!carRes.data) return null

  const fuelEntries = (fuelRes.data ?? []) as FuelEntry[]
  const odometerReadings = (odoRes.data ?? []) as OdometerReading[]

  return {
    car: carRes.data,
    photoUrl: await signPhoto(carRes.data.photo_path),
    fuelEntries,
    odometerReadings,
    currentKm: currentKm(carRes.data, fuelEntries, odometerReadings),
  }
}

/** Auto singola (per i form di modifica). */
export async function getCar(carId: string): Promise<Car | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cars')
    .select('*')
    .eq('id', carId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Solo le righe auto (id + model) per i selettori. */
export async function getCarsLite(): Promise<Pick<Car, 'id' | 'model'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cars')
    .select('id, model')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Rifornimenti dell'utente (opzionalmente di una sola auto), con il modello. */
export async function getFuelEntries(carId?: string): Promise<FuelEntryWithCar[]> {
  const supabase = await createClient()
  let query = supabase
    .from('fuel_entries')
    .select('*, car:cars(model)')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (carId) query = query.eq('car_id', carId)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as FuelEntryWithCar[]
}

export async function getFuelEntryById(id: string): Promise<FuelEntryWithCar | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fuel_entries')
    .select('*, car:cars(model)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as FuelEntryWithCar) ?? null
}

/** Dati per i grafici consumi/percorrenze: tutte le auto + rifornimenti + letture. */
export async function getConsumiData(): Promise<
  { car: Car; fuelEntries: FuelEntry[]; odometerReadings: OdometerReading[] }[]
> {
  const supabase = await createClient()

  const [carsRes, fuelRes, odoRes] = await Promise.all([
    supabase.from('cars').select('*').order('created_at', { ascending: true }),
    supabase
      .from('fuel_entries')
      .select('*')
      .order('entry_date', { ascending: true }),
    supabase
      .from('odometer_readings')
      .select('*')
      .order('reading_date', { ascending: true }),
  ])

  if (carsRes.error) throw carsRes.error
  const cars = carsRes.data ?? []
  const fuel = (fuelRes.data ?? []) as FuelEntry[]
  const odo = (odoRes.data ?? []) as OdometerReading[]

  return cars.map((car) => ({
    car,
    fuelEntries: fuel.filter((f) => f.car_id === car.id),
    odometerReadings: odo.filter((o) => o.car_id === car.id),
  }))
}
