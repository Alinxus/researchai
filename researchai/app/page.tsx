'use client'
import React, { useState } from 'react';
import { PlusCircle, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const reportSections = [
  { id: 'executive_summary', title: 'Executive Summary' },
  { id: 'market_overview', title: 'Market Overview' },
  { id: 'competitor_analysis', title: 'Competitor Analysis' },
  { id: 'swot_analysis', title: 'SWOT Analysis' },
  { id: 'emerging_trends', title: 'Emerging Trends' },
  { id: 'strategic_recommendations', title: 'Strategic Recommendations' },
];

export default function Home() {
  const [competitors, setCompetitors] = useState(['']);
  const [selectedSections, setSelectedSections] = useState(reportSections.map(section => section.id));
  const [reportFormat, setReportFormat] = useState('detailed');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCompetitorChange = (index, value) => {
    const newCompetitors = [...competitors];
    newCompetitors[index] = value;
    setCompetitors(newCompetitors);
  };

  const addCompetitor = () => {
    setCompetitors([...competitors, '']);
  };

  const removeCompetitor = (index) => {
    const newCompetitors = competitors.filter((_, i) => i !== index);
    setCompetitors(newCompetitors);
  };

  const toggleReportSection = (id) => {
    setSelectedSections(prevSections =>
      prevSections.includes(id)
        ? prevSections.filter(sectionId => sectionId !== id)
        : [...prevSections, id]
    );
  };

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/Pastel Pink Green Blue Minimal Doodle A4 Document.pdf');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'competitive_intelligence_report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('An error occurred while generating the report. Please try again.');
    }
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-gray-800">
            AI-Powered Competitive Intelligence Report Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-700">Competitors</h2>
            {competitors.map((competitor, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={competitor}
                  onChange={(e) => handleCompetitorChange(index, e.target.value)}
                  placeholder={`Competitor ${index + 1}`}
                  className="flex-grow"
                />
                {index > 0 && (
                  <Button variant="outline" size="icon" onClick={() => removeCompetitor(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button onClick={addCompetitor} variant="outline" className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Competitor
            </Button>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Report Sections</h2>
            <div className="grid grid-cols-2 gap-4">
              {reportSections.map(section => (
                <div key={section.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={section.id}
                    checked={selectedSections.includes(section.id)}
                    onCheckedChange={() => toggleReportSection(section.id)}
                  />
                  <label htmlFor={section.id} className="text-sm text-gray-700">
                    {section.title}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Report Format</h2>
            <Select value={reportFormat} onValueChange={setReportFormat}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="detailed">Detailed</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
                <SelectItem value="presentation">Presentation-style</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={generateReport}
            disabled={isGenerating}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105"
          >
            {isGenerating ? (
              'Generating Report...'
            ) : (
              <>
                <FileText className="mr-2 h-5 w-5" />
                Generate AI-Powered Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}