import pandas as pd
from infrastructure.clientGarmin import get_client

def fetch_simplified_data():
    client = get_client()

    try:
        # TODO: Prendere tutte le attività
        # Fetching activities (last 30 activities)
        print("Downloading last 30 activities...")
        activities = client.get_activities(0, 30)

        # Conversion in DataFrame Pandas
        df = pd.DataFrame(activities)

        # Selection of relevant columns and date cleaning
        cols_to_keep = ['startTimeLocal', 'distance', 'duration', 'averageHR', 'activityType']
        df = df[cols_to_keep]

        # Conversion of distance from meters to kilometers, duration from seconds to minutes and date to datetime
        df['distance'] = (df['distance'] / 1000).round(2)
        df['duration'] = (df['duration'] / 60).round(2)
        df['startTimeLocal'] = pd.to_datetime(df['startTimeLocal'])

        # Filtration of running activities
        df_running = df[df['activityType'].apply(lambda x: x['typeKey'] == 'running')]
        print(f"Found {len(df_running)} running activities.")

        # Save data to CSV for future use
        df_running.to_csv('running_activities.csv', index=False)
        print(f"Update completed. Saved {len(df_running)} running activities.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_simplified_data()