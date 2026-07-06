# Stage 1: Build the C# app using .NET SDK
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore dependencies
COPY DentalClinic.csproj ./
RUN dotnet restore

# Copy all files and publish release
COPY . ./
RUN dotnet publish -c Release -o /app/publish -f net8.0

# Stage 2: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
# Copy static frontend files (wwwroot) explicitly to the run directory
COPY wwwroot/ ./wwwroot/
# Copy the database schema SQL file to initialize SQLite database
COPY schema.sql ./

# Expose port (default 5000)
EXPOSE 5000

# Set environment variables for Render
ENV PORT=5000
ENV HOST=*

# Run the backend executable
ENTRYPOINT ["dotnet", "DentalClinicBackend.dll"]
