import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Heart, ExternalLink, Mail } from "lucide-react";
import { type College } from "@shared/schema";
import { useLikedColleges } from "@/hooks/use-liked-colleges";
import { SavedBadge } from "@/components/saved-badge";
import { isCollegeSaved, useSavedItems } from "@/hooks/use-saved-items";

interface CollegeCardProps {
  college: College;
  onViewDetails: () => void;
  searchPreferences?: any;
}

export default function CollegeCard({ college, onViewDetails, searchPreferences }: CollegeCardProps) {
  const { isLiked, toggleLikedCollege } = useLikedColleges();
  const { keys: savedKeys } = useSavedItems();
  const isSaved = isCollegeSaved(savedKeys, college);
  const calculateMatchScore = () => {
    let score = 0;
    let factors = 0;

    if (searchPreferences) {
      // Sport match
      if (searchPreferences.sport && college.sportsPrograms.includes(searchPreferences.sport)) {
        score += 30;
      }
      factors += 30;

      // Academic level match
      if (searchPreferences.academicLevel && college.academicLevel === searchPreferences.academicLevel) {
        score += 20;
      }
      factors += 20;

      // Location match
      if (searchPreferences.location && college.location.toLowerCase().includes(searchPreferences.location.toLowerCase())) {
        score += 20;
      }
      factors += 20;

      // Tuition filter
      if (searchPreferences.tuitionCap && college.tuition <= parseInt(searchPreferences.tuitionCap)) {
        score += 15;
      }
      factors += 15;

      // Acceptance rate filter
      if (searchPreferences.minAcceptanceRate && college.acceptanceRate >= parseInt(searchPreferences.minAcceptanceRate)) {
        score += 10;
      }
      factors += 10;

      // Graduation rate filter
      if (searchPreferences.minGraduationRate && college.graduationRate >= parseInt(searchPreferences.minGraduationRate)) {
        score += 5;
      }
      factors += 5;
    }

    return factors > 0 ? Math.round((score / factors) * 100) : 85;
  };

  const matchScore = calculateMatchScore();

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const formatTuition = (tuition: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(tuition);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {college.imageUrl && (
            <img
              src={college.imageUrl}
              alt={`${college.name} campus`}
              className="w-full lg:w-48 h-48 object-cover rounded-lg"
            />
          )}
          
          <div className="flex-1">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="text-xl font-bold text-gray-900">{college.name}</h4>
                  {isSaved && <SavedBadge />}
                </div>
                <p className="text-gray-600 mb-2">{college.location}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-500 mr-1" />
                    <span className="text-sm font-medium">{college.rating || 4}</span>
                  </div>
                  <span className="text-sm text-gray-500 capitalize">{college.type} University</span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className={isLiked(college.id) ? "text-red-500" : "text-gray-400 hover:text-red-500"}
                onClick={() => toggleLikedCollege({
                  id: college.id,
                  name: college.name,
                  city: college.city,
                  state: college.state || undefined,
                  tuition: college.tuition,
                  website: college.website || undefined
                })}
                data-testid={`button-like-college-${college.id}`}
              >
                <Heart className={`w-4 h-4 ${isLiked(college.id) ? "fill-current" : ""}`} />
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Tuition</p>
                <p className="font-semibold text-secondary">{formatTuition(college.tuition)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Acceptance Rate</p>
                <p className="font-semibold">{college.acceptanceRate}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Graduation Rate</p>
                <p className="font-semibold">{college.graduationRate}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Match Score</p>
                <p className={`font-semibold ${getMatchScoreColor(matchScore)}`}>
                  {matchScore}%
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {searchPreferences?.sport && college.sportsPrograms.includes(searchPreferences.sport) && (
                <Badge variant="default" className="text-xs">
                  Strong {searchPreferences.sport} Program
                </Badge>
              )}
              {college.walkOnAvailable && (
                <Badge variant="outline" className="text-xs">
                  Walk-on Opportunities
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={onViewDetails}>
                View Details
              </Button>
              {college.coachEmail && (
                <Button variant="outline" size="sm">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact Coach
                </Button>
              )}
              {college.website && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(college.website!, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit Website
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
