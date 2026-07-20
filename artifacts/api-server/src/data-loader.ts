import { DataPopulationService } from "./data-sources";
import { db } from "./db";
import { colleges, careerPaths, scholarships } from "@workspace/db";
import { count } from "drizzle-orm";
import { popularColleges } from "./popular-colleges-data";
import { scholarshipService } from "./comprehensive-scholarship-service";
import { careerDatabaseLoader } from "./career-database-loader";

// Auto-populate database on server start if empty
export async function initializeDatabase() {
  console.log('Checking database for existing data...');

  try {
    const [collegeCount] = await db.select({ count: count(colleges.id) }).from(colleges);
    const [careerCount] = await db.select({ count: count(careerPaths.id) }).from(careerPaths);
    const [scholarshipCount] = await db.select({ count: count(scholarships.id) }).from(scholarships);

    console.log(`Database check: ${collegeCount.count} colleges, ${careerCount.count} careers, ${scholarshipCount.count} scholarships`);

    // Best-effort attempt at live external sources (College Scorecard,
    // O*NET web service, scholarship feeds) when starting from a totally
    // empty database. Each of these already catches its own errors and
    // silently yields nothing if a key is missing or the service is
    // unreachable, so this is never the only source of data — see the
    // hardcoded fallbacks below, which used to only run on a *partially*
    // populated database, leaving a fresh database with no reliable data
    // at all if the live sources didn't return anything.
    if (collegeCount.count === 0 && careerCount.count === 0 && scholarshipCount.count === 0) {
      console.log('Database is empty. Attempting live data sources...');
      const dataService = new DataPopulationService();
      await dataService.populateAllData();
    }

    // Regardless of whether the live fetch above ran or worked, fall back
    // to the hardcoded authentic datasets for anything still empty. These
    // don't depend on any external API or key, so they're the reliable
    // baseline every deployment can count on.
    console.log('Adding popular universities to ensure comprehensive coverage...');
    for (const college of popularColleges) {
      try {
        await db.insert(colleges).values(college).onConflictDoNothing();
      } catch (error) {
        console.log(`Skipped ${college.name}: ${error}`);
      }
    }

    const [careerCountAfter] = await db.select({ count: count(careerPaths.id) }).from(careerPaths);
    if (careerCountAfter.count === 0) {
      console.log('Loading authentic O*NET career data...');
      const { loaded, skipped } = await careerDatabaseLoader.loadONETCareers();
      console.log(`Career loading complete: ${loaded} loaded, ${skipped} skipped`);
    }

    const [scholarshipCountAfter] = await db.select({ count: count(scholarships.id) }).from(scholarships);
    if (scholarshipCountAfter.count === 0) {
      console.log('Loading comprehensive scholarship database...');
      const authenticScholarships = scholarshipService.getAuthenticScholarships();
      for (const scholarship of authenticScholarships) {
        try {
          await db.insert(scholarships).values(scholarship);
        } catch (error) {
          console.log(`Skipped scholarship ${scholarship.name}: ${error}`);
        }
      }
      console.log(`Loaded ${authenticScholarships.length} authentic scholarships.`);
    }

    console.log('Database initialization complete.');
  } catch (error) {
    console.warn('Could not auto-populate database:', error);
    console.log('Data can be loaded manually via /api/populate-data endpoint');
  }
}
