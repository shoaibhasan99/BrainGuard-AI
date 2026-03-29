import React, { useState } from 'react';
import { seedDoctors } from '../lib/seedDoctors';
import { Loader2, Users } from 'lucide-react';

/**
 * Component to seed doctors into the database
 * This should be used once to populate the database with test doctors
 * Can be added to an admin panel or run manually
 */
const SeedDoctorsButton: React.FC = () => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; created: number } | null>(null);

  const handleSeed = async () => {
    if (!window.confirm('This will create doctor profiles in the database. Continue?')) {
      return;
    }

    setIsSeeding(true);
    setResult(null);

    try {
      const seedResult = await seedDoctors();
      setResult(seedResult);
      
      if (seedResult.success) {
        alert(`✅ Successfully seeded ${seedResult.created} doctors!\n\n${seedResult.message}`);
      } else {
        alert(`⚠️ Seeding completed with some errors:\n\n${seedResult.message}`);
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Unknown error occurred',
        created: 0
      });
      alert(`❌ Error seeding doctors: ${error.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-2">Seed Doctors</h3>
      <p className="text-sm text-gray-400 mb-4">
        Click the button below to create Pakistani brain specialist doctors in the database.
        This only needs to be done once.
      </p>
      <button
        onClick={handleSeed}
        disabled={isSeeding}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      >
        {isSeeding ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Seeding Doctors...</span>
          </>
        ) : (
          <>
            <Users className="w-4 h-4" />
            <span>Seed Doctors</span>
          </>
        )}
      </button>
      {result && (
        <div className={`mt-4 p-3 rounded ${result.success ? 'bg-green-900/30' : 'bg-yellow-900/30'}`}>
          <p className={`text-sm ${result.success ? 'text-green-400' : 'text-yellow-400'}`}>
            {result.message}
          </p>
          {result.created > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Created {result.created} doctor profile(s)
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SeedDoctorsButton;


















