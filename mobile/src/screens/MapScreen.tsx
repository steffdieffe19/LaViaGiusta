import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Map, Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { RootStackParamList } from '../navigation/types';
import { TrailsApi } from '../services/api/trails';
import { colors, spacing, typography } from '../theme';

type MapScreenRouteProp = RouteProp<RootStackParamList, 'Map'>;
type MapScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Map'>;

interface Props {
  route: MapScreenRouteProp;
  navigation: MapScreenNavigationProp;
}

// Coordinate focus for Valle Castellana as a strictly typed 2-element tuple
const VALLE_CASTELLANA_COORD: [number, number] = [13.4980, 42.7400]; // [longitude, latitude]

export default function MapScreen({ route, navigation }: Props) {
  const { trailId, trailName } = route.params;
  const [geojson, setGeojson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGeoJson() {
      try {
        const data = await TrailsApi.fetchGeoJSON(trailId);
        setGeojson(data);
      } catch (err) {
        console.error('Error fetching trail GeoJSON', err);
      } finally {
        setLoading(false);
      }
    }
    loadGeoJson();
  }, [trailId]);

  return (
    <View style={styles.container}>
      {/* MapLibre Map */}
      <Map 
        style={styles.map}
        mapStyle="https://demotiles.maplibre.org/style.json" // Standard open source style for testing
        logo={false}
        attribution={false}
      >
        <Camera 
          zoom={13} 
          center={VALLE_CASTELLANA_COORD} 
          duration={1500}
        />
        
        {/* Draw GPX LineString overlay */}
        {geojson && (
          <GeoJSONSource id="trail-path-source" data={geojson}>
            <Layer
              id="trail-path-line"
              type="line"
              paint={{
                'line-color': colors.success,
                'line-width': 5,
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </GeoJSONSource>
        )}
      </Map>

      {/* Header Overlay */}
      <SafeAreaView style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>{trailName}</Text>
            <Text style={styles.subtitle}>Mappa Sentiero</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.success} />
          <Text style={styles.loadingText}>Caricamento tracciato...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(30, 30, 30, 0.9)', // Semi-transparent glassmorphism style card
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18, 18, 18, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text,
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});
