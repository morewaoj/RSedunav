import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Mail, Phone, Star, MapPin, DollarSign, GraduationCap, Users } from "lucide-react";
import { type College } from "@shared/schema";

interface CollegeModalProps {
  college: College;
  isOpen: boolean;
  onClose: () => void;
}

export default function CollegeModal({ college, isOpen, onClose }: CollegeModalProps) {
  const formatTuition = (tuition: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(tuition);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-3">
            {college.name}
            <div className="flex items-center text-sm">
              <Star className="w-4 h-4 text-yellow-500 mr-1" />
              <span>{college.rating || 4}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Hero Image and Basic Info */}
          <div className="flex flex-col lg:flex-row gap-6">
            {college.imageUrl && (
              <img
                src={college.imageUrl}
                alt={`${college.name} campus`}
                className="w-full lg:w-64 h-48 object-cover rounded-lg"
              />
            )}
            <div className="flex-1 space-y-4">
              <div className="flex items-center text-gray-600">
                <MapPin className="w-4 h-4 mr-2" />
                {college.location}
              </div>
              <p className="text-gray-700">{college.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  {college.type} University
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {college.academicLevel} Academic Level
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Key Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="w-6 h-6 text-secondary mx-auto mb-2" />
                <p className="text-2xl font-bold text-secondary">{formatTuition(college.tuition)}</p>
                <p className="text-sm text-gray-600">Annual Tuition</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-primary">{college.acceptanceRate}%</p>
                <p className="text-sm text-gray-600">Acceptance Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <GraduationCap className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{college.graduationRate}%</p>
                <p className="text-sm text-gray-600">Graduation Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Star className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-600">{college.rating || 4}/5</p>
                <p className="text-sm text-gray-600">Overall Rating</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Sports Programs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sports Programs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {college.sportsPrograms.map((sport) => (
                  <Badge key={sport} variant="outline" className="justify-center py-2">
                    {sport.charAt(0).toUpperCase() + sport.slice(1)}
                  </Badge>
                ))}
              </div>
              {college.walkOnAvailable && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800 font-medium">✓ Walk-on opportunities available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Scholarships */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Scholarships</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {college.scholarships.map((scholarship) => (
                  <div key={scholarship} className="p-3 border rounded-lg">
                    <p className="font-medium capitalize">{scholarship} Scholarships</p>
                    <p className="text-sm text-gray-600">
                      {scholarship === 'academic' && 'Merit-based funding for high achievers'}
                      {scholarship === 'athletic' && 'Sports performance-based awards'}
                      {scholarship === 'need-based' && 'Financial assistance based on need'}
                      {scholarship === 'international' && 'Special funding for international students'}
                      {scholarship === 'entrance' && 'Awards for incoming students'}
                      {scholarship === 'leadership' && 'Recognition for leadership excellence'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Coach Contact Information */}
          {(college.coachName || college.coachEmail || college.coachPhone) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Coach Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {college.coachName && (
                    <p className="font-medium text-gray-900">{college.coachName}</p>
                  )}
                  {college.coachEmail && (
                    <div className="flex items-center text-gray-600">
                      <Mail className="w-4 h-4 mr-2" />
                      <a href={`mailto:${college.coachEmail}`} className="hover:text-primary">
                        {college.coachEmail}
                      </a>
                    </div>
                  )}
                  {college.coachPhone && (
                    <div className="flex items-center text-gray-600">
                      <Phone className="w-4 h-4 mr-2" />
                      <a href={`tel:${college.coachPhone}`} className="hover:text-primary">
                        {college.coachPhone}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4">
            {college.coachEmail && (
              <Button onClick={() => window.open(`mailto:${college.coachEmail}`)}>
                <Mail className="w-4 h-4 mr-2" />
                Contact Coach
              </Button>
            )}
            {college.website && (
              <Button variant="outline" onClick={() => window.open(college.website, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Visit Website
              </Button>
            )}
            <Button variant="outline">
              <Star className="w-4 h-4 mr-2" />
              Save to Favorites
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
