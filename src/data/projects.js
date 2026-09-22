// Copy the block below, paste it as a new entry in the `projects` array,
// and fill it in. Delete any of the optional fields you don't need —
// each section on the project page only renders if its field is present.
//
// {
//   slug: 'my-new-project',              // required, unique — used in the URL: /projects/my-new-project
//   title: 'My New Project',             // required
//   tagline: 'One-line summary',         // optional — shown under the title
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
//   whatWeLearned: [                     // optional
//     'What challenges came up, and what would you do differently?',
//   ],
//   tech: ['React', 'Node.js'],          // optional — shown as tags under "Technologies"
//   collaborators: ['Name One', 'Name Two'], // optional — shown as tags under "Collaborators"
//   link: '#',                           // optional — live demo URL, omit or set to null to hide
//   github: '#',                         // optional — repo URL, omit or set to null to hide
//   gallery: [                           // optional — extra images shown at the bottom
//     '/images/projects/my-new-project-2.png',
//     '/images/projects/my-new-project-3.png',
//   ],
// },

const projects = [
  {
    slug: 'CFBowledge',
    title: 'CFBowledge',
    tagline: '(2026) College Football Game',
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
