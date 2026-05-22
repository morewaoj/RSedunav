import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Save, Filter } from "lucide-react";
import CollegeCard from "@/components/college-card";
import CollegeModal from "@/components/college-modal";
import { useMatchingEngine } from "@/lib/matching-engine";
import { type College } from "@shared/schema";

export default function Results() {
  const { searchResults, isLoading } = useMatchingEngine();
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [sortBy, setSortBy] = useState("match");
  const [sortedResults, setSortedResults] = useState<College[]>([]);
  const [searchPreferences, setSearchPreferences] = useState<any>(null);

  useEffect(() => {
    // Load search preferences from localStorage
    const saved = localStorage.getItem('collegeSearchPreferences');
    if (saved) {
      setSearchPreferences(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (searchResults.length > 0) {
      let sorted = [...searchResults];
      
      switch (sortBy) {
        case "tuition-low":
          sorted.sort((a, b) => a.tuition - b.tuition);
          break;
        case "tuition-high":
          sorted.sort((a, b) => b.tuition - a.tuition);
          break;
        case "acceptance":
          sorted.sort((a, b) => b.acceptanceRate - a.acceptanceRate);
          break;
        case "graduation":
          sorted.sort((a, b) => b.graduationRate - a.graduationRate);
          break;
        case "rating":
          sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        default:
          // Keep original order (already sorted by match score)
          break;
      }
      
      setSortedResults(sorted);
    }
  }, [searchResults, sortBy]);

  const handleExportPDF = () => {
    // Basic PDF export functionality
    const content = sortedResults.map(college => 
      `${college.name} - ${college.location}\nTuition: $${college.tuition}\nAcceptance Rate: ${college.acceptanceRate}%\n\n`
    ).join('');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'college-recommendations.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Finding your perfect matches...</p>
          </div>
        </div>
      </main>
    );
  }

  if (sortedResults.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Matches Found</h2>
            <p className="text-gray-600 mb-6">
              Try adjusting your search criteria to find more colleges that match your preferences.
            </p>
            <Button onClick={() => window.history.back()}>
              Modify Search
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {sortedResults.length} Colleges Match Your Criteria
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match">Best Match</SelectItem>
                  <SelectItem value="tuition-low">Tuition (Low to High)</SelectItem>
                  <SelectItem value="tuition-high">Tuition (High to Low)</SelectItem>
                  <SelectItem value="acceptance">Acceptance Rate</SelectItem>
                  <SelectItem value="graduation">Graduation Rate</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {searchPreferences && (
              <div className="flex gap-2 flex-wrap">
                {searchPreferences.sport && (
                  <Badge variant="default">
                    {searchPreferences.sport} Programs
                  </Badge>
                )}
                {searchPreferences.location && (
                  <Badge variant="secondary">
                    {searchPreferences.location}
                  </Badge>
                )}
                {searchPreferences.academicLevel && (
                  <Badge variant="outline">
                    {searchPreferences.academicLevel} Academic
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-6">
        {sortedResults.map((college) => (
          <CollegeCard
            key={college.id}
            college={college}
            onViewDetails={() => setSelectedCollege(college)}
            searchPreferences={searchPreferences}
          />
        ))}
      </div>

      {/* College Modal */}
      {selectedCollege && (
        <CollegeModal
          college={selectedCollege}
          isOpen={!!selectedCollege}
          onClose={() => setSelectedCollege(null)}
        />
      )}
    </main>
  );
}
