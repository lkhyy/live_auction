module.exports = {
  beforeScenario: function (context, events, done) {
    context.vars.auctionId = process.env.AUCTION_ID || '';
    return done();
  },
};
