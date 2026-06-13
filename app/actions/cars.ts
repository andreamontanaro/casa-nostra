'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { CAR_PHOTOS_BUCKET } from '@/lib/car-photos'
import type { Database } from '@/types/database'

type FuelType = Database['public']['Enums']['fuel_type']

function parseDecimal(raw: string | null): number {
  return parseFloat((raw ?? '').replace(',', '.'))
}

function parseIntOrNull(raw: string | null): number | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  const n = parseInt(v.replace(/\./g, ''), 10)
  return isNaN(n) ? null : n
}

function revalidateCars(carId?: string) {
  revalidatePath('/auto')
  revalidatePath('/auto/rifornimenti')
  revalidatePath('/auto/consumi')
  if (carId) revalidatePath(`/auto/${carId}`)
}

// ============================================================
// Auto
// ============================================================

export type CarFormState = {
  error?: string
  fieldErrors?: Partial<Record<string, string>>
  ok?: boolean
  carId?: string
}

function readCarForm(formData: FormData) {
  const model = ((formData.get('model') as string) ?? '').trim()
  const fuelType = formData.get('fuel_type') as FuelType
  const rawYear = formData.get('year') as string
  const rawTank = formData.get('tank_capacity') as string
  const rawInitialKm = formData.get('initial_km') as string

  const fieldErrors: Record<string, string> = {}

  if (!model) fieldErrors.model = 'Il modello è obbligatorio.'
  if (!fuelType) fieldErrors.fuel_type = 'Scegli il tipo di carburante.'

  let year: number | null = null
  if ((rawYear ?? '').trim()) {
    year = parseInt(rawYear, 10)
    if (isNaN(year) || year < 1900 || year > 2100) {
      fieldErrors.year = 'Inserisci un anno valido.'
    }
  }

  let tankCapacity: number | null = null
  if ((rawTank ?? '').trim()) {
    tankCapacity = parseDecimal(rawTank)
    if (isNaN(tankCapacity) || tankCapacity <= 0) {
      fieldErrors.tank_capacity = 'Capacità non valida.'
    }
  }

  let initialKm = parseIntOrNull(rawInitialKm) ?? 0
  if (initialKm < 0) {
    fieldErrors.initial_km = 'I km non possono essere negativi.'
    initialKm = 0
  }

  return { model, fuelType, year, tankCapacity, initialKm, fieldErrors }
}

export async function createCar(
  _prev: CarFormState,
  formData: FormData,
): Promise<CarFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const { model, fuelType, year, tankCapacity, initialKm, fieldErrors } =
    readCarForm(formData)
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { data: inserted, error } = await supabase
    .from('cars')
    .insert({
      owner_id: user.id,
      model,
      fuel_type: fuelType,
      year,
      tank_capacity: tankCapacity,
      initial_km: initialKm,
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidateCars(inserted.id)
  // Il client carica l'eventuale foto e poi naviga.
  return { ok: true, carId: inserted.id }
}

export async function updateCar(
  id: string,
  _prev: CarFormState,
  formData: FormData,
): Promise<CarFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const { model, fuelType, year, tankCapacity, initialKm, fieldErrors } =
    readCarForm(formData)
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error } = await supabase
    .from('cars')
    .update({
      model,
      fuel_type: fuelType,
      year,
      tank_capacity: tankCapacity,
      initial_km: initialKm,
    })
    .eq('id', id)

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidateCars(id)
  return { ok: true, carId: id }
}

export async function deleteCar(id: string) {
  const supabase = await createClient()

  // Rimuovi la foto dallo Storage prima di eliminare la riga.
  const { data: car } = await supabase
    .from('cars')
    .select('photo_path')
    .eq('id', id)
    .maybeSingle()
  if (car?.photo_path) {
    await supabase.storage.from(CAR_PHOTOS_BUCKET).remove([car.photo_path])
  }

  // La FK ON DELETE CASCADE elimina rifornimenti e letture km.
  const { error } = await supabase.from('cars').delete().eq('id', id)
  if (error) throw new Error("Errore durante l'eliminazione.")

  revalidateCars()
  redirect('/auto?ok=car-deleted')
}

// ============================================================
// Rifornimenti
// ============================================================

export type FuelFormState = {
  error?: string
  fieldErrors?: Partial<Record<string, string>>
}

function readFuelForm(formData: FormData) {
  const carId = formData.get('car_id') as string
  const entryDate = formData.get('entry_date') as string
  const liters = parseDecimal(formData.get('liters') as string)
  const pricePerLiter = parseDecimal(formData.get('price_per_liter') as string)
  const totalCost = parseDecimal(formData.get('total_cost') as string)
  const odometerKm = parseIntOrNull(formData.get('odometer_km') as string)
  const fullTank = formData.get('full_tank') === '1'
  const notes = ((formData.get('notes') as string) ?? '').trim() || null

  const fieldErrors: Record<string, string> = {}
  if (!carId) fieldErrors.car_id = 'Scegli un\'auto.'
  if (!entryDate) fieldErrors.entry_date = 'Inserisci la data.'
  if (isNaN(liters) || liters <= 0) fieldErrors.liters = 'Litri non validi.'
  if (isNaN(pricePerLiter) || pricePerLiter <= 0)
    fieldErrors.price_per_liter = 'Prezzo al litro non valido.'
  if (isNaN(totalCost) || totalCost <= 0)
    fieldErrors.total_cost = 'Totale non valido.'
  if (odometerKm != null && odometerKm < 0)
    fieldErrors.odometer_km = 'I km non possono essere negativi.'

  return {
    carId,
    entryDate,
    liters,
    pricePerLiter,
    totalCost,
    odometerKm,
    fullTank,
    notes,
    fieldErrors,
  }
}

export async function createFuelEntry(
  _prev: FuelFormState,
  formData: FormData,
): Promise<FuelFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const f = readFuelForm(formData)
  if (Object.keys(f.fieldErrors).length > 0) return { fieldErrors: f.fieldErrors }

  const { error } = await supabase.from('fuel_entries').insert({
    car_id: f.carId,
    entry_date: f.entryDate,
    liters: f.liters,
    price_per_liter: f.pricePerLiter,
    total_cost: f.totalCost,
    odometer_km: f.odometerKm,
    full_tank: f.fullTank,
    notes: f.notes,
    created_by: user.id,
  })

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidateCars(f.carId)
  redirect('/auto/rifornimenti?ok=fuel-created')
}

export async function updateFuelEntry(
  id: string,
  _prev: FuelFormState,
  formData: FormData,
): Promise<FuelFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const f = readFuelForm(formData)
  if (Object.keys(f.fieldErrors).length > 0) return { fieldErrors: f.fieldErrors }

  const { error } = await supabase
    .from('fuel_entries')
    .update({
      car_id: f.carId,
      entry_date: f.entryDate,
      liters: f.liters,
      price_per_liter: f.pricePerLiter,
      total_cost: f.totalCost,
      odometer_km: f.odometerKm,
      full_tank: f.fullTank,
      notes: f.notes,
    })
    .eq('id', id)

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidateCars(f.carId)
  redirect('/auto/rifornimenti?ok=fuel-updated')
}

export async function deleteFuelEntry(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('fuel_entries').delete().eq('id', id)
  if (error) throw new Error("Errore durante l'eliminazione.")

  revalidateCars()
  redirect('/auto/rifornimenti?ok=fuel-deleted')
}

// ============================================================
// Letture contachilometri
// ============================================================

export type OdometerFormState = {
  error?: string
  fieldErrors?: Partial<Record<string, string>>
  ok?: boolean
}

export async function createOdometerReading(
  _prev: OdometerFormState,
  formData: FormData,
): Promise<OdometerFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const carId = formData.get('car_id') as string
  const readingDate = formData.get('reading_date') as string
  const km = parseIntOrNull(formData.get('km') as string)
  const rawAvgConsumption = formData.get('avg_consumption') as string
  const consumptionUnit = formData.get('consumption_unit') as string | null

  const fieldErrors: Record<string, string> = {}
  if (!carId) fieldErrors.car_id = 'Auto mancante.'
  if (!readingDate) fieldErrors.reading_date = 'Inserisci la data.'
  if (km == null || km < 0) fieldErrors.km = 'Inserisci un chilometraggio valido.'

  let avgConsumption: number | null = null
  if ((rawAvgConsumption ?? '').trim()) {
    avgConsumption = parseDecimal(rawAvgConsumption)
    if (isNaN(avgConsumption) || avgConsumption <= 0) {
      fieldErrors.avg_consumption = 'Consumo non valido.'
    }
    if (!consumptionUnit || !['km_l', 'l_100km'].includes(consumptionUnit)) {
      fieldErrors.consumption_unit = 'Scegli l\'unità di misura.'
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const { error } = await supabase.from('odometer_readings').insert({
    car_id: carId,
    reading_date: readingDate,
    km: km!,
    avg_consumption: avgConsumption,
    consumption_unit: avgConsumption ? consumptionUnit : null,
    created_by: user.id,
  })

  if (error) return { error: 'Errore durante il salvataggio. Riprova.' }

  revalidateCars(carId)
  return { ok: true }
}

export async function deleteOdometerReading(id: string, carId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('odometer_readings').delete().eq('id', id)
  if (error) throw new Error("Errore durante l'eliminazione.")

  revalidateCars(carId)
}
