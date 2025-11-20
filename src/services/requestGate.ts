let intakePaused = false;

export const isIntakePaused = () => intakePaused;

export const setIntakePaused = (value: boolean) => {
  intakePaused = value;
  return intakePaused;
};

export const toggleIntake = () => {
  intakePaused = !intakePaused;
  return intakePaused;
};
