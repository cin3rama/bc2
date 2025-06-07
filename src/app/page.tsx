import Layout from './layout';

const Home = () => {
  return (
      <>
        <h2 className="text-2xl font-bold text-text dark:text-text-inverted">Welcome to Bitcoinisle</h2>
        <p className="text-text dark:text-text-inverted">Explore insights, trends, and real-time data on Bitcoin.</p>
        <div className="h-64 bg-surface dark:bg-secondary-dark">[Chart Placeholder]</div>
      </>
  );
}
export default Home;