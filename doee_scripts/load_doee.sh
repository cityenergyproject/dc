#!/bin/bash
set -o errexit #abort if any command fails
#
#
# 1. to run, make sure this script is in the same directory
#    as the yearly CSV(s) you'll want to load
#
# 2. then cd to that directoy
#
# 3. change the environment variables to match your system and run:
#
# DBNAME=<your-database-name> \
# TABLE=<database-tablename> \
# CSVNAME=<name-of-csv> \
# DBUSER=<your-db-username> ./load_doee.sh
#
#

WDIR=$(pwd)
if [ -z ${DBNAME} ] && [ -z ${DBUSER} ] && [ -z ${TABLE} ] && [ -z ${CSVNAME} ]; then echo "you need to set environment variables 'DBNAME','DBUSER','TABLE', 'CSVNAME'"; exit 1; else echo "DBNAME='$DBNAME' DBUSER='$DBUSER' TABLE='$TABLE' CSVNAME='$CSVNAME'"; fi
DBNAME=${DBNAME}
DBUSER=${DBUSER}
TABLENAME=${TABLE}
CSVFULLPATH=$WDIR/${CSVNAME}.csv
if [ ! -f $CSVFULLPATH ]; then echo "the file '$CSVFULLPATH' does not exist"; exit 1; fi


# load
psql_load="
CREATE TABLE ${TABLENAME}(
    pid VARCHAR (255),
    dc_real_pid VARCHAR (255),
    pm_pid VARCHAR (255),
    property_name VARCHAR (255),
    pm_parent_pid VARCHAR (255),
    parent_property_name VARCHAR (255),
    year_ending VARCHAR (255),
    report_status VARCHAR (255),
    address_of_record VARCHAR (255),
    owner_of_record VARCHAR (255),
    ward VARCHAR (255),
    reported_address VARCHAR (255),
    city VARCHAR (255),
    state VARCHAR (255),
    postal_code VARCHAR (255),
    year_built INTEGER,
    primary_ptype_self VARCHAR (255),
    primary_ptype_epa VARCHAR (255),
    tax_record_floor_area DOUBLE PRECISION,
    reported_gross_floor_area DOUBLE PRECISION,
    energy_star_score INTEGER,
    site_eui DOUBLE PRECISION,
    weather_norm_site_eui DOUBLE PRECISION,
    source_eui DOUBLE PRECISION,
    weather_norm_source_eui DOUBLE PRECISION,
    total_ghg_emissions DOUBLE PRECISION,
    total_ghg_emissions_intensity DOUBLE PRECISION,
    water_use DOUBLE PRECISION,
    electricity_use DOUBLE PRECISION,
    natural_gas_use DOUBLE PRECISION,
    fuel_use DOUBLE PRECISION,
    district_water_use DOUBLE PRECISION,
    metered_areas_energy VARCHAR (255),
    metered_areas_water VARCHAR (255),
    xcoordinate DOUBLE PRECISION,
    ycoordinate DOUBLE PRECISION,
    ycorrected DOUBLE PRECISION,
    xcorrected DOUBLE PRECISION
);
COPY ${TABLENAME} FROM '$CSVFULLPATH' DELIMITER '|' CSV HEADER;"
psql -U $DBUSER -d $DBNAME -c "DROP TABLE IF EXISTS ${TABLENAME}"
psql -U $DBUSER -d $DBNAME -c "$psql_load"


psql_transform="
ALTER TABLE ${TABLENAME} ADD COLUMN the_geom geometry(Point,4326);
ALTER TABLE ${TABLENAME} ADD COLUMN needs_geocoding INTEGER DEFAULT 0;
ALTER TABLE ${TABLENAME} ADD COLUMN is_geocoded INTEGER DEFAULT 0;
UPDATE ${TABLENAME} set the_geom = ST_SetSRID(ST_Point(xcoordinate, ycoordinate),4326) WHERE xcoordinate IS NOT NULL AND ycoordinate IS NOT NULL;
UPDATE ${TABLENAME} set the_geom = ST_SetSRID(ST_Point(xcorrected, ycorrected),4326) WHERE xcorrected IS NOT NULL AND ycorrected IS NOT NULL;
UPDATE ${TABLENAME} set needs_geocoding = 1 WHERE the_geom IS NULL;
UPDATE ${TABLENAME} SET address_of_record = NULL WHERE address_of_record LIKE ANY ('{\"Exempt%\",\"%Report%\",\"%Compliance%\"}');"

psql -U $DBUSER -d $DBNAME -c "$psql_transform"
