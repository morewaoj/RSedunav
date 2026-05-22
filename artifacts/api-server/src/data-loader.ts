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
    
    const isEmpty = collegeCount.count === 0 && careerCount.count === 0 && scholarshipCount.count === 0;
    
    if (isEmpty) {
      console.log('Database is empty. Populating with authentic data...');
      const dataService = new DataPopulationService();
      await dataService.populateAllData();
      
      // Add popular colleges that might be missing from College Scorecard API
      console.log('Adding popular universities to ensure comprehensive coverage...');
      for (const college of popularColleges) {
        try {
          await db.insert(colleges).values(college).onConflictDoNothing();
        } catch (error) {
          console.log(`Skipped ${college.name}: ${error}`);
        }
      }
      
      console.log('Database initialization complete with authentic datasets.');
    } else {
      console.log(`Database already populated: ${collegeCount.count} colleges, ${careerCount.count} careers, ${scholarshipCount.count} scholarships`);
      
      // Reload scholarships if empty
      if (scholarshipCount.count === 0) {
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
      
      // Always add popular colleges to ensure comprehensive coverage
      console.log('Adding popular universities to ensure comprehensive coverage...');
      for (const college of popularColleges) {
        try {
          await db.insert(colleges).values(college).onConflictDoNothing();
        } catch (error) {
          console.log(`Skipped ${college.name}: ${error}`);
        }
      }
      console.log('Popular universities integration complete.');
      
      // Load O*NET career data if careers table is empty
      if (careerCount.count === 0) {
        console.log('Loading authentic O*NET career data...');
        const { loaded, skipped } = await careerDatabaseLoader.loadONETCareers();
        console.log(`Career loading complete: ${loaded} loaded, ${skipped} skipped`);
      }
    }
  } catch (error) {
    console.warn('Could not auto-populate database:', error);
    console.log('Data can be loaded manually via /api/populate-data endpoint');
  }
}