export const getBiltyAccessAmount = (freightAmount: number) => {
  if (freightAmount <= 10000) {
    return 200;
  }

  if (freightAmount <= 30000) {
    return 300;
  }

  if (freightAmount <= 50000) {
    return 400;
  }

  return 500;
};
