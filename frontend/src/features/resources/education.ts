/**
 * The text of the Education page, as plain data so it is easy to read and review. These guides
 * explain ideas and the figures FinTk shows. They never say what to buy or sell, never predict,
 * and any example is labelled as an example with round numbers.
 */

export interface Guide {
  id: string;
  title: string;
  /** One short paragraph each. */
  paragraphs: readonly string[];
}

export interface GuideGroup {
  id: string;
  title: string;
  intro: string;
  guides: readonly Guide[];
}

export const GUIDE_GROUPS: readonly GuideGroup[] = [
  {
    id: "fundamentals",
    title: "Fundamentals",
    intro: "The terms behind the figures on the markets and coin pages.",
    guides: [
      {
        id: "market-cap",
        title: "What market capitalization means",
        paragraphs: [
          "Market capitalization is the price of one coin times the number of coins in circulation. It is a way to compare the size of coins, not a count of the money that has been put into one.",
          "It is only as good as the supply figure behind it. Two coins with the same price can be very different in size if one has far more coins in circulation.",
        ],
      },
      {
        id: "price-vs-size",
        title: "Why a low price does not mean a small coin",
        paragraphs: [
          "The price of one coin says nothing about how big the coin is. A coin priced at a few cents can be larger than one priced at thousands of dollars, because size depends on price and supply together.",
          "That is why the markets page ranks coins by market capitalization, not by price.",
        ],
      },
      {
        id: "volume",
        title: "Trading volume",
        paragraphs: [
          "Volume is the value of a coin that changed hands over the last 24 hours. It shows how actively a coin is traded.",
          "A large volume is not a sign of quality, and a small one is not a warning. It is one more number to read next to the others.",
        ],
      },
      {
        id: "supply",
        title: "Circulating, total and maximum supply",
        paragraphs: [
          "Circulating supply is the number of coins that are available to the public. Total supply is the number that exist, minus any that have been permanently removed. Maximum supply is the most that can ever exist, and not every coin has one.",
          "Coin pages show all three where they are reported. A figure that is not reported is shown as not available.",
        ],
      },
      {
        id: "stablecoins",
        title: "Stablecoins",
        paragraphs: [
          "A stablecoin is a coin designed to keep a steady price, most often one US dollar. That is why its change over a day or a week is usually close to zero.",
          "How a stablecoin holds its price depends on the coin and on what stands behind it. A stablecoin can still drift from its target price, so a small change is normal and a large one is worth reading about at the source.",
        ],
      },
      {
        id: "share",
        title: "Bitcoin's share of the market",
        paragraphs: [
          "Bitcoin's share is its market capitalization divided by the market capitalization of all coins. Ethereum's share is worked out the same way.",
          "A share can rise even when Bitcoin's price falls, if the rest of the market falls faster. It describes how the total is divided, not whether prices are going up or down.",
        ],
      },
      {
        id: "fear-greed",
        title: "The Fear and Greed index",
        paragraphs: [
          "The index is a score from 0 to 100 published by CoinMarketCap. Low scores are labelled fear and high scores greed.",
          "It is a summary of mood at one moment. It does not predict what happens next, and FinTk shows it exactly as CoinMarketCap reports it. How it is built is explained in CoinMarketCap's methodology.",
        ],
      },
    ],
  },
  {
    id: "portfolio",
    title: "Reading a portfolio",
    intro: "How the numbers on the holdings page are worked out.",
    guides: [
      {
        id: "gain-loss",
        title: "Gain or loss, and why percentages are not symmetric",
        paragraphs: [
          "Gain or loss is what your holding is worth now minus what you paid. The percentage is that gain or loss divided by what you paid. For example, if you paid $1,000 and the holding is now worth $1,250, the gain is $250, which is 25 percent.",
          "Percentages do not work the same in both directions. A holding that falls 50 percent needs to rise 100 percent to get back to where it started. This is arithmetic, not a forecast.",
        ],
      },
      {
        id: "cost",
        title: "What you paid, and more than one purchase",
        paragraphs: [
          "FinTk uses the total you enter as paid for each coin. If you bought a coin more than once, add the amounts and the totals together. Your average cost is the total paid divided by the total amount.",
          "FinTk cannot check what you enter, and it does not include fees or tax. A coin with no amount paid has a value but no gain or loss.",
        ],
      },
    ],
  },
  {
    id: "research",
    title: "Reading research",
    intro: "Habits that make any figure or headline easier to trust.",
    guides: [
      {
        id: "period-change",
        title: "What a change over a period tells you",
        paragraphs: [
          "A change over 30 days compares the price now with the price 30 days ago. It says nothing about what happened in between. A coin can be down over 30 days and up over 90, because the two periods start from different prices.",
          "Read several periods together, and remember that a change over a period is a fact about the past, not about the future.",
        ],
      },
      {
        id: "allegations",
        title: "Reading an announcement of charges",
        paragraphs: [
          "When an agency announces charges or a complaint, that is an allegation. It is not a finding. Releases often say so near the end, and the outcome comes later, often in a separate release.",
          "Read the release itself, check its date, and look for a later one on the same matter before drawing a conclusion from a headline.",
        ],
      },
      {
        id: "questions",
        title: "Four questions to ask of any figure",
        paragraphs: [
          "Where does it come from, and who published it? How old is it? What is the unit, and over what period? What is missing from it?",
          "FinTk answers these on the Data and methodology page, and the Source directory points to the originals.",
        ],
      },
    ],
  },
];
