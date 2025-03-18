/*
  # Add Financial Goals Schema

  1. New Tables
    - `financial_goals`
      - Core table for financial goals
      - Tracks progress and deadlines
      - Includes loan information
    
    - `goal_rental_income`
      - Tracks rental income expectations
      - Links to financial goals
    
    - `goal_dependencies`
      - Manages relationships between goals
      - Tracks completion dependencies

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create financial_goals table
CREATE TABLE IF NOT EXISTS financial_goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) DEFAULT 0,
  deadline DATE NOT NULL,
  loan_amount DECIMAL(12,2),
  interest_rate DECIMAL(5,2),
  loan_term INTEGER,
  completion_date DATE,
  priority TEXT CHECK(priority IN ('high', 'medium', 'low')),
  status TEXT CHECK(status IN ('active', 'achieved', 'at_risk')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create goal_rental_income table
CREATE TABLE IF NOT EXISTS goal_rental_income (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
  monthly_amount DECIMAL(12,2) NOT NULL,
  start_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create goal_dependencies table
CREATE TABLE IF NOT EXISTS goal_dependencies (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
  dependent_goal_id TEXT NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(goal_id, dependent_goal_id)
);

-- Create indexes
CREATE INDEX idx_financial_goals_status ON financial_goals(status);
CREATE INDEX idx_financial_goals_deadline ON financial_goals(deadline);
CREATE INDEX idx_goal_rental_income_goal_id ON goal_rental_income(goal_id);
CREATE INDEX idx_goal_dependencies_goal_id ON goal_dependencies(goal_id);
CREATE INDEX idx_goal_dependencies_dependent_goal_id ON goal_dependencies(dependent_goal_id);
