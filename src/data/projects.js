// Copy the block below, paste it as a new entry in the `projects` array,
// and fill it in. Delete any of the optional fields you don't need —
// each section on the project page only renders if its field is present.
//
// {
//   slug: 'my-new-project',              // required, unique — used in the URL: /projects/my-new-project
//   title: 'My New Project',             // required
//   tagline: 'One-line summary',         // optional — shown under the title
//   date: 'March 2026',                  // optional — 'Month YYYY', adds the project to the About page timeline
//   image: '/images/projects/my-new-project.png', // required — header/tile image, drop the file in public/images/projects/
//   inspiration: [                       // optional — one string per paragraph
//     'What problem or idea sparked this project?',
//   ],
//   whatItDoes: [                        // optional
//     'What does it do, from a user’s point of view?',
//   ],
//   howWeBuiltIt: [                      // optional
//     'What’s the stack/architecture? Anything interesting about how it was built?',
//   ],
//   conclusions: [                       // optional
//     'What did the project find or show?',
//   ],
//   whatWeLearned: [                     // optional
//     'What challenges came up, and what would you do differently?',
//   ],
//   tech: ['React', 'Node.js'],          // optional — shown as tags under "Technologies"
//   collaborators: ['Name One', 'Name Two'], // optional — shown as tags under "Collaborators"
//   link: '#',                           // optional — live demo URL, omit or set to null to hide
//   linkLabel: 'Try it live',            // optional — demo button text (default: picked from the link)
//   github: '#',                         // optional — repo URL, omit or set to null to hide
//   gallery: [                           // optional — extra images shown at the bottom
//     '/images/projects/my-new-project-2.png',
//     '/images/projects/my-new-project-3.png',
//   ],
// },

const projects = [
  {
    slug: 'cfbargain',
    title: 'CFBargain',
    tagline: '(2026) CFB Transfer Analysis',
    date: 'October 2026',
    image: '/images/projects/cfbargain.png',
    inspiration: [
      'College football has entered a new era, the NIL era, and it has changed the landscape of the sport, especially when it comes to building a roster. With schools now paying players to transfer in, I was curious which transfers gave their new team the best return on investment, so I built this project to find out!',
    ],
    whatItDoes: [
      'NIL contracts aren\'t public, so I used each player\'s transfer portal rating as a stand-in for his price: in theory, higher-rated players get bigger deals. To measure performance, I used PPA (Predicted Points Added), which measures how much each play a player is involved in changes his team\'s expected points, added up over the season.',
      'For every quarterback, running back, wide receiver and tight end who transferred between FBS schools from 2021 to 2025, CFBargain compares the PPA he actually produced in his first season at his new school with the PPA a typical player at his position and rating produces. The difference is his return on investment. The site ranks players by position, ranks schools by the average return of their transfers, and has a page for every player and school, with charts to explore it all.',
    ],
    howWeBuiltIt: [
      'The data comes from the CollegeFootballData.com API: transfer portal entries, recruiting-style portal ratings, and player stats and PPA. A Python pipeline (pandas, scikit-learn and RapidFuzz) matches each transfer to his stats before and after he moved, estimates a rating for the roughly 1 in 4 transfers who didn\'t have one, fits a line for each position that predicts PPA from rating, and exports the results as JSON for the site.',
      'The site itself is built with React and Vite, with React Router handling the player and school pages. The charts are hand-built SVG, so I could control details like coloring dots by rank and using school logos as the dots on the team chart.',
    ],
    conclusions: [
      'Portal ratings barely predict how a transfer will play: they explain only 6–14% of the differences in production. A player\'s stats from the season before he transferred are a better guide, and players with no stats that season were the riskiest, with only 59% getting into a game at their new school.',
      'Most transfers fall short of their price. Only about a third beat it, and the top 10% account for about 60% of all the value above expectations. Also, no school has figured the portal out: a school\'s return one season has almost no relationship to its return the next.',
      'All in all, the portal is more of a slot machine than a guaranteed upgrade: most pulls lose a little, and a few big hits carry the value.',
    ],
    whatWeLearned: [
      'I approached this project out of curiosity, but I didn\'t come in with a specific question to answer, so I ended up drifting a lot while building it. The results are interesting, but it isn\'t the most valuable project in the world. Next time, I\'ll start with a specific, valuable question and build from there.',
    ],
    tech: ['Python', 'pandas', 'scikit-learn', 'React', 'React Router', 'Vite', 'JavaScript', 'CSS', 'SVG', 'CollegeFootballData API'],
    link: 'https://liferouby.com/cfbargain',
  },

  {
    slug: 'CFBowledge',
    title: 'CFBowledge',
    tagline: '(2026) College Football Game',
    date: 'August 2026',
    image: '/images/projects/cfbowledge.png',
    inspiration: [
      'I am a huge fan of College Football and I wanted an excuse to cheer for more than just Clemson, so I conceived a game that made my friends and I fans of 10 different teams for the season.',
    ],
    whatItDoes: [
      'Each of the 8 participants drafted 10 teams at the beginning of the year, and these teams gain points each week by winning games. Underdog wins gain more points than favored wins, so there was a lot of strategy involved in the drafting process and the dropping/adding for each participant. Everyone also made preseason predicitons for the season, which offer a chance to gain bonus points at the end of the year!',
    ],
    whatWeLearned: [
      'This project gave me great exposure to what it is like to create an interface that others use competitively, which is something that I have never delt with before. It was also my first experience designing a game, and it will not be my last.',
    ],
    tech: ['React', 'React Router', 'Vite', 'JavaScript', 'CSS'],
    link: 'https://liferouby.com/cfbowledge',
  },

  {
    slug: 'strikephone',
    title: 'Strikephone',
    tagline: '(2025) CUHackit Project',
    date: 'February 2025',
    image: '/images/projects/strikephone.png',
    inspiration: [
      'My friends and I play a lot of blitzball, which is a backyard sport similar to baseball. The advantage that blitzball has over baseball is that the ball that is used is much lighter, enabling it to spin and curve much more, especially when pitching. The issue that comes with this is that it can be hard to tell what pitches were balls and what pitches are strikes.',
    ],
    whatItDoes: [
      'StrikePhone is an app that will take care of the ball/strike calling issue for you! It works by the user setting their phone up behind home plate. The user sets the camera up, takes a quick calibration image, and then records each pitch. After each pitch is recorded, the app returns whether it is a ball or a strike and displays it to the user. StrikePhone makes blitzball easier to play and avoids arguments over whether a pitch is a ball or a strike!',
    ],
    whatWeLearned: [
      'This project was an intense learning stretch for our entire group, since we had never worked with AWS or AI models before. While we weren’t able to make a polished final product, we learned a lot about needing to communicate and share code frequently throughout the development process to ensure that our functionalities can easily communicate with each other. Additionally, we learned a lot about app development, Expo Go, JavaScript and TypeScript.',
    ],
    tech: ['Javascript','React Native', 'Expo Go', 'AWS', 'GitHub'],
    collaborators: ['Life Rouby', 'Kenny Sun', 'Kathleen Kirk', 'Aarav Chowbey'],
    link: 'https://devpost.com/software/strikephone',
    github: 'https://github.com/StrikePhone',
  },

  {
    slug: 'anybike',
    title: 'AnyBike',
    tagline: '(2023) SPARK Entrepreneurship Program',
    date: 'October 2023',
    image: '/images/projects/anybike.png',
    inspiration: [
      'My friend and I both wanted e-bikes, but as broke college students, we couldn\'t afford them. With funding from Clemson University\'s SPARK Entrepreneurship Program, we were able to build a prototype electric bike conversion kit.',
    ],
    whatItDoes: [
      'The kit works by pressing a tensioned, motor-powered wheel against the rear wheel of any bike, spinning it to help power the bike forward. The idea was to make e-biking more affordable than buying a dedicated e-bike, while letting riders turn any bike they already own into one.',
    ],
    whatWeLearned: [
      'This project gave us great exposure to working with electrical components. More importantly, it taught us what it takes to bring a product from idea to prototype, and how to craft a compelling pitch for it.',
    ],
    collaborators: ['Life Rouby', 'Aarav Chowbey'],
    link: 'https://youtu.be/Y32KDnrEmtA',
  },
]

export default projects
